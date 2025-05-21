#!/usr/bin/env python3
"""
extract_mobile_towers.py

Purpose:
Processes ACMA RRL data files to extract mobile tower information and create a
comprehensive GeoJSON file for use in the application. This is a one-time
processing script that generates a static dataset for the map display.

This script:
- Identifies mobile towers from license, device, and site data
- Classifies towers by carrier (Telstra, Optus, Vodafone)
- Determines technology types (3G, 4G, 5G) based on frequency and emission
- Extracts technical parameters like height, power, azimuth, etc.
- Generates a GeoJSON file in the public directory for the application

Usage:
python extract_mobile_towers.py [--input-dir DIRECTORY] [--output-file FILENAME]

For example:
python extract_mobile_towers.py --input-dir=/path/to/spectra_rrl --output-file=../public/data/mobile_towers.geojson
"""

import csv
import json
import argparse
import os
import re
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Set, Tuple, Any, Optional

# Carrier identification
CARRIER_MAP = {
    'telstra': {
        'client_ids': ['1104504', '20053843', '20006709'],
        'name_patterns': ['telstra', 'amplitel', 'tcl']
    },
    'optus': {
        'client_ids': ['1561', '510769', '512112'],
        'name_patterns': ['optus', 'singtel']
    },
    'vodafone': {
        'client_ids': ['536353', '1103274', '1133304', '1136980'],
        'name_patterns': ['vodafone', 'tpg', 'hutchison', 'vha']
    }
}

# Technology identification based on frequency and emission
TECHNOLOGY_INDICATORS = {
    '5g': {
        'frequency_ranges': [(3300, 3800), (24000, 30000), (700, 800)],
        'emission_patterns': ['9M86G7W', 'G7W'],
        'name_patterns': ['5g', 'amplitel monopole', 'mmwave']
    },
    '4g': {
        'frequency_ranges': [(700, 900), (1800, 2100), (2300, 2600)],
        'emission_patterns': ['5M00G7W', '10M0G7W', '15M0G7W', '20M0G7W'],
        'name_patterns': ['4g', 'lte', 'b28']
    },
    '3g': {
        'frequency_ranges': [(850, 950), (1800, 2200)],
        'emission_patterns': ['5M00F9W', 'F9W'],
        'name_patterns': ['3g', 'umts', 'hspa', 'wcdma']
    }
}

def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Extract mobile tower data from ACMA RRL files')
    parser.add_argument('--input-dir', type=str, default='.', 
                        help='Directory containing ACMA RRL CSV files')
    parser.add_argument('--output-file', type=str, default='mobile_towers.geojson',
                        help='Output GeoJSON file path')
    return parser.parse_args()

def determine_carrier(client_id: str, name: str) -> str:
    """Determine carrier based on client ID and name patterns"""
    name_lower = name.lower() if name else ''
    
    # Try client ID first (most reliable)
    for carrier, info in CARRIER_MAP.items():
        if client_id in info['client_ids']:
            return carrier
    
    # Try name patterns
    for carrier, info in CARRIER_MAP.items():
        for pattern in info['name_patterns']:
            if pattern in name_lower:
                return carrier
    
    return 'other'

def determine_technology(frequency: Optional[int], emission: Optional[str], name: Optional[str]) -> str:
    """Determine technology type (3G/4G/5G) based on frequency, emission, and name"""
    name_lower = name.lower() if name else ''
    freq_mhz = frequency / 1000000 if frequency else 0
    
    # Check name patterns first (most reliable)
    for tech, indicators in TECHNOLOGY_INDICATORS.items():
        for pattern in indicators['name_patterns']:
            if pattern in name_lower:
                return tech
    
    # Check emission designator
    if emission:
        for tech, indicators in TECHNOLOGY_INDICATORS.items():
            for pattern in indicators['emission_patterns']:
                if pattern in emission:
                    return tech
    
    # Check frequency ranges
    if freq_mhz > 0:
        for tech, indicators in TECHNOLOGY_INDICATORS.items():
            for min_freq, max_freq in indicators['frequency_ranges']:
                if min_freq <= freq_mhz <= max_freq:
                    return tech
    
    # Default to 4G (most common)
    return '4g'

def read_csv_file(filepath: str) -> List[Dict[str, str]]:
    """Read a CSV file and return a list of dictionaries"""
    try:
        with open(filepath, 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            return list(reader)
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return []

def extract_mobile_towers(input_dir: str) -> List[Dict[str, Any]]:
    """Extract mobile tower data from ACMA RRL files"""
    # File paths
    site_file = os.path.join(input_dir, 'site.csv')
    licence_file = os.path.join(input_dir, 'licence.csv')
    device_file = os.path.join(input_dir, 'device_details.csv')
    client_file = os.path.join(input_dir, 'client.csv')
    
    print(f"Reading data files from {input_dir}")
    
    # Load client data for carrier identification
    clients = {row['CLIENT_NO']: row for row in read_csv_file(client_file)}
    print(f"Loaded {len(clients)} clients")
    
    # Identify mobile licenses (PTS type or mobile carriers)
    licenses = {}
    mobile_license_ids = set()
    for row in read_csv_file(licence_file):
        license_no = row['LICENCE_NO']
        client_no = row['CLIENT_NO']
        license_type = row['LICENCE_TYPE_NAME']
        
        licenses[license_no] = row
        
        # Check if this is a mobile license
        is_mobile = False
        if 'PTS' in license_type:
            is_mobile = True
        elif client_no in clients:
            client_name = clients[client_no].get('LICENCEE', '').lower()
            for carrier_info in CARRIER_MAP.values():
                for pattern in carrier_info['name_patterns']:
                    if pattern in client_name:
                        is_mobile = True
                        break
        
        if is_mobile:
            mobile_license_ids.add(license_no)
    
    print(f"Identified {len(mobile_license_ids)} mobile licenses out of {len(licenses)} total")
    
    # Load site data
    sites = {row['SITE_ID']: row for row in read_csv_file(site_file)}
    print(f"Loaded {len(sites)} sites")
    
    # Process device details to identify mobile towers
    site_devices = defaultdict(list)
    
    for row in read_csv_file(device_file):
        license_no = row['LICENCE_NO']
        site_id = row['SITE_ID']
        
        # Only consider devices associated with mobile licenses
        if license_no in mobile_license_ids and site_id in sites:
            site_devices[site_id].append(row)
    
    print(f"Found {len(site_devices)} sites with mobile devices")
    
    # Create consolidated tower records
    mobile_towers = []
    
    for site_id, devices in site_devices.items():
        site = sites.get(site_id)
        if not site:
            continue
        
        # Skip sites without coordinates
        try:
            latitude = float(site['LATITUDE'])
            longitude = float(site['LONGITUDE'])
            if latitude == 0 and longitude == 0:
                continue
        except (ValueError, KeyError):
            continue
        
        # Aggregate device information
        technologies = set()
        carriers = set()
        heights = []
        azimuths = []
        frequencies = []
        emissions = []
        eirps = []
        license_nos = set()
        
        for device in devices:
            license_no = device['LICENCE_NO']
            license_data = licenses.get(license_no, {})
            client_no = license_data.get('CLIENT_NO', '')
            client_data = clients.get(client_no, {})
            
            # Extract device attributes
            frequency_str = device.get('FREQUENCY', '')
            emission = device.get('EMISSION', '')
            height_str = device.get('HEIGHT', '')
            azimuth_str = device.get('AZIMUTH', '')
            eirp_str = device.get('EIRP', '')
            
            # Convert and collect data
            try:
                if frequency_str and frequency_str.strip():
                    frequencies.append(int(frequency_str))
                if emission:
                    emissions.append(emission)
                if height_str and height_str.strip():
                    heights.append(float(height_str))
                if azimuth_str and azimuth_str.strip():
                    azimuths.append(float(azimuth_str))
                if eirp_str and eirp_str.strip():
                    eirps.append(float(eirp_str))
            except ValueError:
                pass
            
            # Determine carrier
            client_name = client_data.get('LICENCEE', '')
            site_name = site.get('NAME', '')
            carrier = determine_carrier(client_no, client_name or site_name)
            carriers.add(carrier)
            
            # Determine technology
            frequency = int(frequency_str) if frequency_str and frequency_str.strip() else None
            tech = determine_technology(frequency, emission, site_name)
            technologies.add(tech)
            
            # Add license number
            license_nos.add(license_no)
        
        # Create tower record
        tower = {
            'id': site_id,
            'name': site.get('NAME', f"Tower {site_id}"),
            'latitude': latitude,
            'longitude': longitude,
            'carrier': list(carriers)[0] if carriers else 'other',
            'carriers': list(carriers),
            'technology': list(technologies)[0] if technologies else 'unknown',
            'technologies': list(technologies),
            'state': site.get('STATE', ''),
            'postcode': site.get('POSTCODE', ''),
            'elevation': float(site.get('ELEVATION', 0)) if site.get('ELEVATION') else None,
            'licence_nos': list(license_nos)
        }
        
        # Add additional technical details if available
        if heights:
            tower['height'] = max(heights)
        if frequencies:
            tower['frequency'] = frequencies[0]  # Use first frequency (arbitrary choice)
        if azimuths:
            # Use most common azimuth if there are multiple
            tower['azimuth'] = max(set(azimuths), key=azimuths.count)
        if emissions:
            tower['emission'] = emissions[0]  # Use first emission (arbitrary choice)
        if eirps:
            tower['eirp'] = max(eirps)
            tower['eirp_unit'] = device.get('EIRP_UNIT', 'W')
        
        mobile_towers.append(tower)
    
    print(f"Created {len(mobile_towers)} mobile tower records")
    return mobile_towers

def create_geojson(towers: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Convert tower data to GeoJSON format"""
    features = []
    
    for tower in towers:
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [tower['longitude'], tower['latitude']]
            },
            "properties": {key: value for key, value in tower.items() if key not in ['longitude', 'latitude']}
        }
        features.append(feature)
    
    geojson = {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "generatedAt": datetime.now().isoformat(),
            "towerCount": len(features)
        }
    }
    
    return geojson

def main():
    """Main function to extract data and save GeoJSON"""
    args = parse_arguments()
    
    try:
        print(f"Starting extraction from {args.input_dir}")
        
        # Extract tower data
        towers = extract_mobile_towers(args.input_dir)
        
        # Convert to GeoJSON
        geojson = create_geojson(towers)
        
        # Ensure output directory exists
        output_dir = os.path.dirname(args.output_file)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        # Save GeoJSON file
        with open(args.output_file, 'w', encoding='utf-8') as f:
            json.dump(geojson, f, indent=2)
        
        print(f"Successfully saved {len(towers)} mobile tower records to {args.output_file}")
        print(f"Total GeoJSON file size: {os.path.getsize(args.output_file) / (1024*1024):.2f} MB")
        
        # Print basic statistics
        carrier_counts = defaultdict(int)
        technology_counts = defaultdict(int)
        
        for tower in towers:
            carrier_counts[tower['carrier']] += 1
            technology_counts[tower['technology']] += 1
        
        print("\nStatistics:")
        print("Carriers:")
        for carrier, count in carrier_counts.items():
            print(f"  - {carrier}: {count} towers ({count/len(towers)*100:.1f}%)")
        
        print("\nTechnologies:")
        for tech, count in technology_counts.items():
            print(f"  - {tech}: {count} towers ({count/len(towers)*100:.1f}%)")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())