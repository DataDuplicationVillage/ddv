'''
Test for opencv and zbar barcode scanning.
'''
import os
import cv2
from pyzbar.pyzbar import decode
import pillow_heif
import numpy as np
pillow_heif.register_heif_opener()
if __name__ == "__main__":
    print("Testing OpenCV and pyzbar barcode scanning.")
    try:
        print(f"OpenCV version: {cv2.__version__}")
        print(f"pyzbar version: {pyzbar.__version__}")
    except Exception as e:
        print(f"Error importing modules: {e}")

    # lookup image files in the current directory to test barcode scanning.
    
    image_files = []
    for filename in os.listdir("Reference Docs"):
        if filename.lower().endswith((".png", ".jpg", ".jpeg", ".heic")):
            print(f"Found image file: {filename}")
            # add it to the processing list
            image_files.append(filename)
    
    for image in image_files:
        print(f"Processing image file: {image}")
        # remember the start time
        start_time = cv2.getTickCount()
        image_path = os.path.join("Reference Docs", image)
        heif_image = pillow_heif.open_heif(image_path)
        img_from_heif = heif_image.to_pillow()
        img_from_heif = cv2.cvtColor(np.array(img_from_heif), cv2.COLOR_RGB2BGR)
    
        barcodes = decode(img_from_heif)
        if not barcodes:
            print(f"No barcodes found in image: {image}")
        for barcode in barcodes:
            barcode_data = barcode.data.decode("utf-8")
            barcode_type = barcode.type
            end_time = cv2.getTickCount()
            time_taken = (end_time - start_time) / cv2.getTickFrequency()
            print(f"Found barcode in {image}: {barcode_data} (Type: {barcode_type})")
        end_time = cv2.getTickCount()
        time_taken = (end_time - start_time) / cv2.getTickFrequency()
        print(f"Finished processing image file: {image} in {time_taken:.4f} seconds")

