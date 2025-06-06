from flask import Flask, request, jsonify
from flask_cors import CORS
from pyulog import ULog
import pandas as pd
import numpy as np
import os
import sys
import subprocess

# Flask App Setup
app = Flask(__name__)
CORS(app, resources={r"/upload": {"origins": r"http://localhost:\d+"}})
UPLOAD_FOLDER = "uploads"
RESULT_FOLDER = "results"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULT_FOLDER, exist_ok=True)

def process_ulog(file_path, output_path="phase_analysis.json"):
    try:
        # Load ULog data
        ulog = ULog(file_path)

        # Extract data
        vehicle_position = ulog.get_dataset("vehicle_local_position").data
        battery_status = ulog.get_dataset("battery_status").data

        # Create DataFrame for position/velocity and battery data
        df_position = pd.DataFrame(vehicle_position, columns=["timestamp", "vx", "vy", "vz", "z"])
        df_battery = pd.DataFrame(battery_status, columns=["timestamp", "voltage_v", "current_a"])

        # Convert timestamps to seconds from start
        t0_pos = df_position["timestamp"].iloc[0]
        t0_bat = df_battery["timestamp"].iloc[0]
        df_position["time"] = (df_position["timestamp"] - t0_pos) / 1e6
        df_battery["time"] = (df_battery["timestamp"] - t0_bat) / 1e6

        # Merge on nearest time
        df_combined = pd.merge_asof(df_position.sort_values("time"),
                                    df_battery.sort_values("time"), on="time", direction="nearest")

        # Compute additional metrics
        df_combined["horizontal_velocity"] = np.sqrt(df_combined["vx"]**2 + df_combined["vy"]**2)
        df_combined["time_delta"] = df_combined["time"].diff().fillna(0)
        df_combined["altitude"] = -df_combined["z"]  # flip sign for altitude

        # Filter out rows with zero time_delta
        df_combined = df_combined[df_combined["time_delta"] > 0]

        # Thresholds dictionary for classification
        thresholds = {
            "ground_vel": 0.1,
            "cruise_vel": 2.0,
            "altitude_min": 5.0,
            "climb_vz": -0.1,
            "descend_vz": 0.1
        }

        # Conditions for phase classification
        conditions = [
            ((abs(df_combined["vz"]) < thresholds["ground_vel"]) &
             (abs(df_combined["horizontal_velocity"]) < thresholds["ground_vel"]) &
             (df_combined["altitude"] < thresholds["altitude_min"])),
            ((df_combined["horizontal_velocity"] > thresholds["cruise_vel"]) &
             (df_combined["altitude"] >= thresholds["altitude_min"])),
            (df_combined["vz"] > thresholds["descend_vz"]),
            (df_combined["vz"] < thresholds["climb_vz"]),
            ((abs(df_combined["vz"]) < thresholds["ground_vel"]) &
             (df_combined["altitude"] >= thresholds["altitude_min"]))
        ]

        choices = ["On the Ground", "Cruising", "Descending", "Climbing", "Hovering"]
        df_combined["raw_phase"] = np.select(conditions, choices, default="Unknown")

        # Consolidate phases
        def consolidate_phases(df, time_threshold=1.0):
            df = df[["time", "raw_phase", "time_delta"]]
            consolidated = []
            current_phase = df["raw_phase"].iloc[0]
            start_time = df["time"].iloc[0]
            total_time = 0

            for _, row in df.iterrows():
                if row["raw_phase"] == current_phase:
                    total_time += row["time_delta"]
                else:
                    if total_time >= time_threshold:
                        consolidated.append((current_phase, start_time, row["time"]))
                    current_phase = row["raw_phase"]
                    start_time = row["time"]
                    total_time = row["time_delta"]

            if total_time >= time_threshold:
                consolidated.append((current_phase, start_time, df["time"].iloc[-1]))

            return consolidated

        consolidated_phases = consolidate_phases(df_combined)

        # Calculate total and average discharge rates
        df_combined["mAh"] = (df_combined["current_a"] * df_combined["time_delta"]) / 3.6
        total_mAh = df_combined["mAh"].sum()
        total_time = df_combined["time"].iloc[-1] - df_combined["time"].iloc[0]
        avg_mAh_per_s = total_mAh / total_time

        # Exclude "On the Ground" for non-ground calculations
        non_ground = df_combined[df_combined["raw_phase"] != "On the Ground"]
        total_mAh_non_ground = non_ground["mAh"].sum()
        total_time_non_ground = non_ground["time_delta"].sum()
        avg_mAh_per_s_non_ground = total_mAh_non_ground / total_time_non_ground

        # Aggregate phase data
        phase_data = []
        for phase, start, end in consolidated_phases:
            phase_mask = (df_combined["time"] >= start) & (df_combined["time"] < end)
            phase_df = df_combined[phase_mask]
            phase_duration = end - start
            phase_mAh = phase_df["mAh"].sum()
            avg_dr_phase = phase_mAh / phase_duration
            diff_of_avg = (avg_dr_phase / avg_mAh_per_s_non_ground) * 100
            pct_time_of_flight = (phase_duration / total_time) * 100
            phase_data.append({
                "Phase": phase,
                "TotalTime(s)": phase_duration,
                "Total Draw(mAh)": phase_mAh,
                "AvgDr(mAh/s)": avg_dr_phase,
                "DiffofAvg(%)": diff_of_avg,
                "PctTime of Flight(%)": pct_time_of_flight
            })

        # Summarize by phase
        df_phase = pd.DataFrame(phase_data).groupby("Phase", as_index=False).agg({
            "TotalTime(s)": "sum",
            "Total Draw(mAh)": "sum",
            "AvgDr(mAh/s)": "mean",
            "DiffofAvg(%)": "mean",
            "PctTime of Flight(%)": "sum"
        })

        # Add total flight summary
        summary_data = {
            "Phase": "Total Flight Summary",
            "TotalTime(s)": total_time,
            "Total Draw(mAh)": total_mAh,
            "Total Draw per Minute(mAh)": round(total_mAh / (total_time / 60), 2)
        }

        df_phase = pd.concat([df_phase, pd.DataFrame([summary_data])], ignore_index=True)

        # Write output to JSON
        output_file = os.path.join(RESULT_FOLDER, output_path)
        df_phase.to_json(output_file, orient="records")
        return output_file

    except Exception as e:
        return str(e)

@app.route("/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if file.filename == "" or not file.filename.endswith(".ulg"):
        return jsonify({"error": "Invalid file format"}), 400

    # Save file to uploads folder
    file_path = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(file_path)

    # Run the analysis
    result_file = process_ulog(file_path)
    if result_file.endswith(".json"):
        with open(result_file, "r") as json_file:
            results = json_file.read()
        return results, 200
    else:
        return jsonify({"error": result_file}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)
