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
from google.ai.generativelanguage_v1beta.types import content
import sys
import json
import io
from pathlib import Path
from pdf2image import convert_from_path
import PIL.Image
from dotenv import load_dotenv
import os 
import re
import json_repair
import PIL
from openpyxl.styles import Font, PatternFill
import pandas as pd

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
        "form_data": content.Schema(
            type=content.Type.ARRAY,
            items=content.Schema(
                type=content.Type.OBJECT,
                properties={
                    "question": content.Schema(
                        type=content.Type.STRING,
                    ),
                    "answer": content.Schema(
                        type=content.Type.STRING,
                    ),
                },
                required=["question", "answer"],
            ),
        ),
    },
    required=["form_data"],
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
    genconfig = genai.GenerationConfig(candidate_count= 1 , temperature= 1.002, top_p=0.95 , top_k=40 , max_output_tokens=65536,response_mime_type="application/json" , response_schema= schema, stop_sequences=["P p p p p p p" , "ppppppp" , "P P P P P P P" , "PP"])
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
You are a highly advanced document processing AI. Your purpose is to convert unstructured document images into structured data suitable for an Excel sheet, with a "Question" and "Answer" column.

PRIMARY TASK:
Your task is to analyze the provided image of a form and extract all the question-and-answer pairs.

DEFINITIONS:

A "question" is the label, title, or column header for a field (e.g., 'Full Name', 'Phone Number', 'اسم المنتج').

An "answer" is the information written, typed, or selected in that field.

If a field is empty, the answer MUST be an empty string "".

CRITICAL RULES:

Extraction Order: Extract the pairs in the logical order they appear on the document (top-to-bottom, right-to-left for Arabic).

Table Handling: The document may contain tables. You must correctly associate the column header (the "question") with the value in each cell of that column (the "answer").

Completeness: You must extract every single question-answer pair you can identify.

Ignore Extraneous Text: Ignore page headers, footers, general instructions, or any text that is not part of a clear question-answer pair.

MANDATORY OUTPUT FORMAT:
Your response MUST be a single, valid JSON object with a single root key: "form_data".

The value of this key must be an array of objects. Each object in the array represents one question-answer pair and MUST contain two keys:

"question": The label for the field.

"answer": The data filled into that field.

EXAMPLE:

JSON

{
  "form_data": [
    {
      "question": "الاسم الكامل",
      "answer": "علي محمد حسين"
    },
    {
      "question": "رقم الهاتف",
      "answer": "07701234567"
    },
    {
      "question": "حالة الطلب",
      "answer": ""
    }
  ]
}
FINAL COMMAND:
Now, process the following document image and return only the JSON object.

"""





def get_excel_file_name(json_data):
    # Extract the form_data list
    form_data = json_data["form_data"]

    # Create DataFrame
    df = pd.DataFrame(form_data)

    # Save to Excel with nice formatting
    with pd.ExcelWriter('form_data.xlsx', engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='Form Data', index=False)
        
        # Get the workbook and worksheet
        workbook = writer.book
        worksheet = writer.sheets['Form Data']
        
        # Auto-adjust column widths
        for column in worksheet.columns:
            max_length = 0
            column_letter = column[0].column_letter
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)
            worksheet.column_dimensions[column_letter].width = adjusted_width
        
        # Style the header row
        
        header_font = Font(bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
        
        for cell in worksheet[1]:
            cell.font = header_font
            cell.fill = header_fill
        return Path('form_data.xlsx')


    # Optional: If you want to read from a JSON file instead
    # with open('your_file.json', 'r', encoding='utf-8') as f:
    #     json_data = json.load(f)


def main():
    """Extract labels from image with optimized processing."""
    if len(sys.argv) < 2:
        print("Error: Missing file path", file=sys.stderr)
        sys.exit(1)
    print("Starting document processing")
    try:
        # Process input file
        image_path = sys.argv[1]
        image_loaded = PIL.Image.open(image_path)
        rows = get_labels(translate_prompt , image_loaded) 
        # Build results efficiently
        path = get_excel_file_name(rows)
        # Output results

        # If you want to add dimensions, you can calculate them here if needed
        result = {
            "file_path": str(path)
            # Optionally add: "dimensions": {"width": ..., "height": ...}
        }
        print(json.dumps(result, ensure_ascii=False))

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()