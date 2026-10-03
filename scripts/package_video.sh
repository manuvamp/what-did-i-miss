#!/bin/bash
set -e

INPUT_VIDEO="$1"
OUTPUT_DIR="$2"
BASENAME="${3:-stream}"

if [ -z "$INPUT_VIDEO" ] || [ -z "$OUTPUT_DIR" ]; then
    echo "Usage: ./package_video.sh <input.mp4> <output_dir> [basename]"
    exit 1
fi

mkdir -p "$OUTPUT_DIR"

# Create HLS segments (10s each) with multiple bitrates
# 1080p, 720p, 480p variants
ffmpeg -i "$INPUT_VIDEO" \
    -filter_complex "[0:v]split=3[v1][v2][v3]; \
        [v1]scale=1920:1080[v1out]; \
        [v2]scale=1280:720[v2out]; \
        [v3]scale=854:480[v3out]" \
    -map "[v1out]" -map a:0 -b:v:0 5000k -maxrate:v:0 5350k -bufsize:v:0 7500k \
    -map "[v2out]" -map a:0 -b:v:1 2800k -maxrate:v:1 2996k -bufsize:v:1 4200k \
    -map "[v3out]" -map a:0 -b:v:2 1400k -maxrate:v:2 1498k -bufsize:v:2 2100k \
    -map 0:a -b:a:0 192k -b:a:1 128k -b:a:2 96k \
    -f hls -hls_time 10 -hls_playlist_type vod \
    -hls_segment_filename "$OUTPUT_DIR/${BASENAME}_%v_%03d.ts" \
    -master_pl_name "${BASENAME}_master.m3u8" \
    -var_stream_map "v:0,a:0 v:1,a:1 v:2,a:2" \
    "$OUTPUT_DIR/${BASENAME}_%v.m3u8"

echo "HLS packaging complete: $OUTPUT_DIR/${BASENAME}_master.m3u8"
