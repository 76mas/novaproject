import time
import keyboard
from pathlib import Path
from pdf2image import convert_from_path
import sys
import json
import google.generativeai as genai , typing
from google.generativeai.types import HarmCategory, HarmBlockThreshold 
from google.generativeai import caching 
from google.api_core.exceptions import Cancelled
from matplotlib import pyplot as plt
from google.ai.generativelanguage_v1beta.types import content
import sys
import json
import io
from pathlib import Path
from pdf2image import convert_from_path
import PIL.Image
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from dotenv import load_dotenv
import os 
import re
import json_repair
import datetime
import PIL
from box_detector import get_bounding_boxes , get_image_with_boxes , extract_full_text_from_image
# Fix encoding issue for Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

print("Loading environment variables...", file=sys.stderr)
load_dotenv()
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')
config = genai.configure(api_key=GOOGLE_API_KEY)
print("Environment variables loaded successfully.", file=sys.stderr)

schema = content.Schema(
    type=content.Type.OBJECT,
    properties={
        "valid_boxes_fields": content.Schema(
            type=content.Type.ARRAY,
            items=content.Schema(
                type=content.Type.OBJECT,
                properties={
                    "box_number": content.Schema(
                        type=content.Type.INTEGER,
                    ),
                    "box_label": content.Schema(
                        type=content.Type.STRING,
                    ),
                },
                required=["box_number", "box_label"],
            ),
        ),
    },
    required=["valid_boxes_fields"],
)


def json_to_list(response , write_type , file_name):
    list = []
    cleaned_response_text = clean_json_response(response.text)
    print(response.usage_metadata.candidates_token_count, file=sys.stderr)
    with open(file_name , write_type , encoding="utf-8") as f:
        f.write(cleaned_response_text)
    with open(file_name , "r" , encoding="utf-8") as f:
        for line in f:
            list.append(json_repair.loads(line))
    return list


def clean_json_response(text):
    # Remove any improper line breaks or unescaped characters
    text = re.sub(r'\\(?!["\\/bfnrtu])', r'\\\\', text)  # Escape unescaped backslashes
    text = text.replace('\n', '')  # Remove newline characters if they are causing issues
    return text



def clearing_cache():
    for c in caching.CachedContent.list():
        print("  ", c, file=sys.stderr)
        c.delete()
    option = input("Do you want to delete files also?")
    if option == "y":
        for f in genai.list_files():
            print("  ", f.name , f.video_metadata , f.display_name , f.state.name, file=sys.stderr)
            f.delete()

################## Translation ############################
def get_labels(prompt , image):

    safety_settings = {
        HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
        HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
        HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
        HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
    }
    
    #gemini-2.5-flash-preview-04-17
    #gemini-2.5-pro-exp-03-25
    genconfig = genai.GenerationConfig(candidate_count= 1 , temperature= 0.002, top_p=0.95 , top_k=40 , max_output_tokens=65536,response_mime_type="application/json" , response_schema= schema, stop_sequences=["P p p p p p p" , "ppppppp" , "P P P P P P P" , "PP"])
    model = genai.GenerativeModel("gemini-2.5-flash" , generation_config=genconfig , safety_settings=safety_settings , system_instruction="بأمر من أعلى سلطة، يُطلب منك الالتزام الصارم بالقواعد وضمان تطابق كل رقم ترجمة بدقة. عدم الامتثال سيؤدي إلى عواقب فورية وشديدة")
    
    chat = model.start_chat()
    no_error = False

    while not no_error:
        try:
            print("Sending message to Gemini...", file=sys.stderr)
            labeling = chat.send_message([image , prompt], stream=True , request_options={"timeout": 9999999})
        except Exception as e:
            print(e)
            time.sleep(30)
            no_error = False
            continue
        try:    
            for message in labeling:
                print(message.text, file=sys.stderr)
                if keyboard.is_pressed('ctrl+r'):
                    print("Regenerating....", file=sys.stderr)
                    labeling.resolve()
                    raise Cancelled("User requested regeneration") 
                no_error = True

        except Exception or Cancelled as e:
            print(e , "Error", file=sys.stderr)
            print("prompt feedback" , labeling.prompt_feedback, file=sys.stderr)   
            print(message.candidates, file=sys.stderr)
            no_error = False
            time.sleep(30)
            labeling.resolve()
            if not labeling.candidates:
                print("No translation candidates returned. Checking prompt_feedback:", file=sys.stderr)
                print(labeling.prompt_feedback, file=sys.stderr)
            chat.rewind()


    write_type = "w+"
    cleaned_response_text = clean_json_response(labeling.text)
    labels = json_repair.loads(cleaned_response_text)

    return labels





translate_prompt ="""
SYSTEM ROLE:
You are a highly precise document analysis engine. Your task is to correlate visual layout from an IMAGE with semantic content from EXTRACTED TEXT to produce a perfect JSON output.

CONTEXT PROVIDED:
I am providing you with two pieces of information:

IMAGE: An image of a form with numbered green boxes marking the input fields.

EXTRACTED TEXT: A string containing the full, raw text content of the entire page, extracted via OCR.

PRIMARY TASK:
Use BOTH the image and the extracted text to determine the correct Arabic label for each numbered box.

CRITICAL ANALYSIS RULES
USE THE IMAGE FOR LAYOUT: Use the image to understand the spatial relationship between a numbered box and the text around it. The correct label is almost always to the RIGHT of or ABOVE the box in Arabic documents.

USE THE TEXT FOR ACCURACY: Use the EXTRACTED TEXT block to find the exact, correct spelling of the label you identified visually. This helps avoid OCR errors.

CORRELATE AND VALIDATE: A label is only valid if its position in the image (right/above the box) AND its presence in the EXTRACTED TEXT block match.

DISCARD INVALID FIELDS: If a numbered box is not a true input field, or you cannot find a corresponding label that satisfies the layout rule (Rule #1), you MUST discard the field. Do not include it in the JSON.

JSON PURITY: Your entire response MUST be a single, raw, valid JSON object. No extra text, no apologies, no markdown.

MANDATORY JSON STRUCTURE
Your output must be a JSON object with a single root key: "valid_boxes_fields".
This key holds an array of objects. Each object represents one valid field and must contain:

"box_number": The field's number (integer).

"box_label": The field's exact Arabic label (string).

Example:

JSON

{
  "valid_boxes_fields": [
    {
      "box_number": 1,
      "box_label": "الاسم الكامل"
    },
    {
      "box_number": 2,
      "box_label": "تاريخ الميلاد"
    }
  ]
}
EXECUTION COMMAND:
Analyze the IMAGE using the EXTRACTED TEXT as your ground truth. Adhere to all rules. Provide only the JSON response.



"""



def draw_labeled_boxes(image, valid_fields, output_path="labeled_boxes_output.png"):
    """
    Draw bounding boxes with their Arabic labels on the image.
    
    Args:
        image: Original image (numpy array or PIL Image)
        valid_fields: List of dictionaries with 'field_details' and 'label'
        output_path: Path to save the output image
    
    Returns:
        PIL Image with drawn boxes and labels
    """
    # Convert to PIL Image if it's a numpy array
    if isinstance(image, np.ndarray):
        if len(image.shape) == 3 and image.shape[2] == 3:
            # BGR to RGB conversion for OpenCV images
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(image)
    else:
        pil_image = image.copy()
    
    # Create a drawing context
    draw = ImageDraw.Draw(pil_image)
    
    # Try to load an Arabic font, fallback to default if not available
    try:
        # You might need to adjust the font path based on your system
        font = ImageFont.truetype("arial.ttf", 16)
    except:
        try:
            # Alternative font paths for Arabic text
            font = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", 16)
        except:
            font = ImageFont.load_default()
    
    # Define colors for boxes and text
    box_color = (255, 0, 0)  # Red
    text_color = (0, 255, 0)  # Green
    text_bg_color = (255, 255, 255, 200)  # White with transparency
    
    for i, field in enumerate(valid_fields):
        # Extract coordinates from field_details tuple
        # Format: (x, y, width, height, score)
        x, y, width, height = field['field_details'][:4]
        label = field['label']
        
        # Draw bounding box
        draw.rectangle([x, y, x + width, y + height], 
                      outline=box_color, 
                      width=2)
        
        # Get text size for background
        bbox = draw.textbbox((0, 0), label, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        
        # Position text above the box (or below if not enough space)
        text_x = x
        text_y = y - text_height - 5 if y - text_height - 5 > 0 else y + height + 5
        
        # Draw text background
        draw.rectangle([text_x - 2, text_y - 2, 
                       text_x + text_width + 2, text_y + text_height + 2],
                      fill=text_bg_color)
        
        # Draw text
        draw.text((text_x, text_y), label, 
                 fill=text_color, 
                 font=font)
        
        # Optional: Draw field number
        field_num = f"{i+1}"
        draw.text((x + 2, y + 2), field_num, 
                 fill=(0, 0, 255),  # Blue
                 font=font)
    pil_image.show()
    return pil_image






def convert_pdf_to_image(pdf_path, dimensions , dpi=100):
    """Convert PDF first page to image with error handling."""
    print(f"Converting PDF: {pdf_path} with dimensions {dimensions}", file=sys.stderr)
    try:
        images = convert_from_path(pdf_path, dpi=72, first_page=1, size=(dimensions['viewportWidth'], dimensions['viewportHeight']))
        if not images:
            raise ValueError("PDF conversion failed - no images generated")
        
        temp_path = Path(pdf_path).with_suffix('.png')
        images[0].save(temp_path, "PNG", optimize=True)
        print(f"PDF converted: {temp_path}", file=sys.stderr)
        return str(temp_path)
    except Exception as e:
        raise RuntimeError(f"PDF conversion error: {e}")

def process_file(file_path , dimensions):
    """Process file based on extension."""
    path = Path(file_path)
    ext = path.suffix.lower()
    
    if ext == '.pdf':
        print("Converting PDF...", file=sys.stderr)
        return convert_pdf_to_image(file_path , dimensions ), True
    elif ext in {'.png', '.jpg', '.jpeg'}:
        print("Processing image...", file=sys.stderr)
        return file_path, False
    else:
        raise ValueError(f"Unsupported file: {ext}")

def main():
    """Extract labels from image with optimized processing."""
    if len(sys.argv) < 2:
        print("Error: Missing file path", file=sys.stderr)
        sys.exit(1)
    
    try:
        # Process input file
        dimensions_json = sys.argv[2]
        dimensions = json.loads(dimensions_json)
        image_path, is_temp = process_file(sys.argv[1] , dimensions)
        # Process image (your existing functions)
        fields, image_data = get_bounding_boxes(image_path)
        print(f"Loaded: {len(fields)} fields", file=sys.stderr)
        print(f"ALL FIELDS: {fields}", file=sys.stderr)
        # Generate numbered boxes and get labels
        numbered_image = get_image_with_boxes(fields, image_data)
        pil_image = PIL.Image.fromarray(numbered_image)
        labels = get_labels(translate_prompt, pil_image)
        # Build results efficiently
        valid_fields = [
            {
                "field_details": fields[field["box_number"] - 1],
                "label": field["box_label"]
            }
            for field in labels["valid_boxes_fields"]
        ]
        draw_labeled_boxes(pil_image, valid_fields, output_path="labeled_boxes_output.png")
        # Output results
        print(json.dumps(valid_fields, ensure_ascii=False))
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        os.remove(image_path)

if __name__ == "__main__":
    main()