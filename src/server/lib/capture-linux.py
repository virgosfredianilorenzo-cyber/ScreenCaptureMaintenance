#!/usr/bin/env python3
"""Fallback screen capture for Linux using Pillow (PIL).
Usage: python3 capture-linux.py > output.png
"""
import sys
from PIL import ImageGrab

img = ImageGrab.grab()
img.save(sys.stdout.buffer, format='PNG')
