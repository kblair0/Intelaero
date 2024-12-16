from pyulog import ULog
import pandas as pd
import numpy as np
from tabulate import tabulate

# Path to your ULog file
ulog_path = "2.ulg"
ulog = ULog(ulog_path)

# Extract vehicle_local_position data for velocity
vehicle_position = ulog.get_dataset("vehicle_local_position").data

# Extract battery_status data for voltage and current
battery_status = ulog.get_dataset("battery_status").data

# Create DataFrame for position and velocity data
df_position = pd.DataFrame({
    "timestamp": vehicle_position["timestamp"],
    "vx": vehicle_position["vx"],  # Horizontal velocity in x-direction
    "vy": vehicle_position["vy"],  # Horizontal velocity in y-direction
    "vz": vehicle_position["vz"],  # Vertical velocity (z-velocity)
    "z": vehicle_position["z"],   # Altitude (z)
})

# Create DataFrame for battery data
df_battery = pd.DataFrame({
    "timestamp": battery_status["timestamp"],
    "voltage": battery_status["voltage_v"],
    "current": battery_status["current_a"]
})

# Convert timestamps to seconds (relative to start)
df_position["time"] = (df_position["timestamp"] - df_position["timestamp"].iloc[0]) / 1e6
df_battery["time"] = (df_battery["timestamp"] - df_battery["timestamp"].iloc[0]) / 1e6

# Merge data on nearest timestamp
df_combined = pd.merge_asof(df_position.sort_values("time"),
                            df_battery.sort_values("time"),
                            on="time",
                            direction="nearest")

# Calculate horizontal velocity (vx, vy)
df_combined["horizontal_velocity"] = np.sqrt(df_combined["vx"]**2 + df_combined["vy"]**2)

# Calculate time deltas
df_combined["time_delta"] = df_combined["time"].diff().fillna(0)

# Flip the altitude (z) since it decreases as altitude increases
df_combined['altitude'] = df_combined['z'] * -1

# Phase classification function with altitude-based check and 5m threshold
def classify_phase(z_velocity, horizontal_velocity, altitude, thresholds=None):
    if thresholds is None:
        thresholds = {
            "ground": 0.1,   # Ground velocity threshold
            "cruise": 2.0,   # Horizontal velocity threshold for cruising
            "altitude": 5.0,  # Minimum altitude for cruise/hover
            "climb": -0.1,    # Threshold for climbing (more negative than this means climbing)
            "descend": 0.1    # Threshold for descending (positive means downward movement)
        }
    
    # Check if on the ground
    if abs(z_velocity) < thresholds["ground"] and abs(horizontal_velocity) < thresholds["ground"] and altitude < thresholds["altitude"]:
        return "On the Ground"
    
    # Check if cruising (horizontal velocity is high and altitude is above threshold)
    elif horizontal_velocity > thresholds["cruise"] and altitude >= thresholds["altitude"]:
        return "Cruising"
    
    # Check if descending (require stronger downward velocity)
    elif z_velocity > thresholds["descend"]:
        return "Descending"
    
    # Check if climbing (increase the threshold for vertical velocity)
    elif z_velocity < thresholds["climb"]:
        return "Climbing"
    
    # Check if hovering (low velocities but at altitude)
    elif abs(z_velocity) < thresholds["ground"] and altitude >= thresholds["altitude"]:
        return "Hovering"
    
    # Default to unknown
    else:
        return "Unknown"

# Apply phase classification with altitude-based check
df_combined["raw_phase"] = df_combined.apply(
    lambda row: classify_phase(row["vz"], row["horizontal_velocity"], row["altitude"]), axis=1
)

# Consolidate phases using a time threshold
def consolidate_phases(df, time_threshold=1.0):
    consolidated = []
    current_phase = df.iloc[0]["raw_phase"]
    start_time = df.iloc[0]["time"]
    total_time = 0

    for i, row in df.iterrows():
        if row["raw_phase"] == current_phase:
            total_time += row["time_delta"]
        else:
            if total_time >= time_threshold:
                consolidated.append((current_phase, start_time, row["time"]))
            current_phase = row["raw_phase"]
            start_time = row["time"]
            total_time = row["time_delta"]

    # Append the last phase
    if total_time >= time_threshold:
        consolidated.append((current_phase, start_time, df.iloc[-1]["time"]))

    return consolidated

consolidated_phases = consolidate_phases(df_combined)

# Calculate the total mAh and average mAh/s for the entire flight excluding "On the Ground"
total_mAh = (df_combined["current"] * df_combined["time_delta"]).sum() / 3600  # Total mAh for entire flight
total_time = df_combined["time"].iloc[-1] - df_combined["time"].iloc[0]  # Total time of the flight in seconds
avg_mAh_per_s = total_mAh / total_time  # Average mAh/s for entire flight

# Exclude "On the Ground" phases for average calculation
non_ground_df = df_combined[df_combined["raw_phase"] != "On the Ground"]
total_mAh_non_ground = (non_ground_df["current"] * non_ground_df["time_delta"]).sum() / 3600  # Total mAh for non-ground phases
total_time_non_ground = non_ground_df["time"].iloc[-1] - non_ground_df["time"].iloc[0]  # Total time excluding "On the Ground"
avg_mAh_per_s_non_ground = total_mAh_non_ground / total_time_non_ground  # Average mAh/s for non-ground phases

# Aggregate the phases
phase_data = []
for phase, start, end in consolidated_phases:
    phase_duration = end - start
    phase_rows = df_combined[(df_combined["time"] >= start) & (df_combined["time"] < end)]
    phase_mAh = (phase_rows["current"] * phase_rows["time_delta"]).sum() / 3600  # mAh during this phase
    avg_dr_phase = phase_mAh / phase_duration  # Avg draw for this phase
    diff_of_avg = (avg_dr_phase / avg_mAh_per_s_non_ground) * 100  # Diff of avg for this phase
    pct_time_of_flight = (phase_duration / total_time) * 100  # Percentage of total flight time in this phase

    phase_data.append({
        "Phase": phase,
        "TotalTime(s)": phase_duration,
        "Total Draw(mAh)": phase_mAh,
        "AvgDr(mAh/s)": avg_dr_phase,
        "DiffofAvg(%)": diff_of_avg,
        "PctTime of Flight(%)": pct_time_of_flight
    })

# Summing and aggregating by phase
df_phase = pd.DataFrame(phase_data)
df_phase = df_phase.groupby('Phase').agg({
    'TotalTime(s)': 'sum',
    'Total Draw(mAh)': 'sum',
    'AvgDr(mAh/s)': 'mean',
    'DiffofAvg(%)': 'mean',
    'PctTime of Flight(%)': 'sum'
}).reset_index()

# Display the results in the terminal window (using tabulate for better formatting)
print("\nDetailed Discharge Analysis by Flight Phase (Summarized):")
print(tabulate(df_phase, headers='keys', tablefmt='pretty', showindex=False))

# Save to Json
df_phase.to_json("../../../public/phaseanalysis.json", orient="records")

