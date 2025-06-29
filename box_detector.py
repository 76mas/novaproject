"""
OCR-Enhanced Field vs Text Detector - Fields Only with Clear Numbering
This script identifies form input fields and displays them with clear numbers inside each field.
"""
import cv2
import numpy as np
import matplotlib.pyplot as plt
from typing import List, Tuple, Dict
import sys
import pytesseract
import warnings
warnings.filterwarnings('ignore')

# Enhanced Parameters
MIN_AREA = 50
MAX_AREA = 50000
MIN_WIDTH = 40
MIN_HEIGHT = 20
ASPECT_RATIO_MIN = 1.8

def get_text_bounding_boxes(image: np.ndarray) -> List[Tuple[int, int, int, int]]:
    """
    Runs OCR on the entire image once to get a list of all text bounding boxes.
    This is much more efficient than running OCR on every single contour.
    """
    print("Step 1: Running global OCR to identify all text regions...", file=sys.stderr)
    try:
        ocr_data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT, lang='ara+eng')
        text_boxes = []
        n_boxes = len(ocr_data['level'])
        for i in range(n_boxes):
            # We only care about detected words with some confidence
            if int(ocr_data['conf'][i]) > 30:  # Confidence threshold
                (x, y, w, h) = (ocr_data['left'][i], ocr_data['top'][i], ocr_data['width'][i], ocr_data['height'][i])
                text_boxes.append((x, y, w, h))
        print(f"Found {len(text_boxes)} text fragments.", file=sys.stderr)
        return text_boxes
    except pytesseract.TesseractNotFoundError:
        print("\n--- TESSERACT ERROR ---", file=sys.stderr)
        print("Tesseract is not installed or not in your system's PATH.", file=sys.stderr)
        return []
    except Exception as e:
        print(f"An error occurred during OCR: {e}", file=sys.stderr)
        return []

def extract_full_text_from_image(image: np.ndarray) -> str:
    """
    Runs OCR on the entire image to extract all text as a single string.
    
    Args:
        image: The input image in NumPy array format (preferably grayscale).
    
    Returns:
        A string containing all the extracted text from the image.
    """
    print("Step 3: Extracting full text content from the page...", file=sys.stderr)
    try:
        # Use image_to_string to get the raw text content.
        # Specify 'ara+eng' to handle both Arabic and any English characters/numbers.
        full_text = pytesseract.image_to_string(image, lang='ara+eng')
        print("Successfully extracted text content.", file=sys.stderr)
        return full_text
    except Exception as e:
        print(f"An error occurred during full text extraction: {e}", file=sys.stderr)
        return ""


def box_contains_text(box_coords: Tuple[int, int, int, int], text_boxes: List[Tuple[int, int, int, int]], 
                     overlap_threshold: float = 0.3) -> bool:
    """
    Check if a detected box contains significant text content.
    
    Args:
        box_coords: (x, y, w, h) of the detected box
        text_boxes: List of OCR-detected text boxes
        overlap_threshold: Minimum overlap ratio to consider text as "inside" the box
    
    Returns:
        True if the box contains significant text content
    """
    bx, by, bw, bh = box_coords
    box_area = bw * bh
    
    total_text_overlap = 0
    text_regions_found = 0
    
    for tx, ty, tw, th in text_boxes:
        # Calculate overlap between box and text region
        overlap_x = max(0, min(bx + bw, tx + tw) - max(bx, tx))
        overlap_y = max(0, min(by + bh, ty + th) - max(by, ty))
        overlap_area = overlap_x * overlap_y
        
        text_area = tw * th
        if text_area == 0:
            continue
            
        # Check if significant portion of text is inside the box
        text_overlap_ratio = overlap_area / text_area
        
        if text_overlap_ratio > overlap_threshold:
            total_text_overlap += overlap_area
            text_regions_found += 1
    
    # Consider it a text box if:
    # 1. It contains multiple text regions, OR
    # 2. Text covers significant portion of the box
    text_coverage_ratio = total_text_overlap / box_area if box_area > 0 else 0
    
    has_significant_text = (
        text_regions_found >= 2 or  # Multiple text fragments
        text_coverage_ratio > 0.15  # Text covers >15% of box area
    )
    
    return has_significant_text


class OCREnhancedFieldAnalyzer:
    def __init__(self):
        self.debug = True

    def analyze_box_type(self, image: np.ndarray, x: int, y: int, w: int, h: int, 
                        text_boxes: List[Tuple[int, int, int, int]]) -> Dict:
        """
        OCR-enhanced analysis to determine if a box is a form field or text area.
        """
        region = image[y:y+h, x:x+w]
        
        analysis = {
            'is_field': False,
            'confidence': 0.0,
            'field_score': 0.0,
            'text_score': 0.0,
            'characteristics': {},
            'has_ocr_text': False
        }
        
        # Primary check: Does this box contain OCR-detected text?
        has_text = box_contains_text((x, y, w, h), text_boxes)
        analysis['has_ocr_text'] = has_text
        
        # If OCR found significant text, it's very likely a text area
        if has_text:
            analysis['text_score'] = 0.8  # High confidence it's text
            analysis['field_score'] = 0.1
            analysis['is_field'] = False
            analysis['confidence'] = 0.8
            analysis['characteristics']['ocr_classification'] = 'TEXT_DETECTED'
            return analysis
        
        # If no OCR text found, analyze visual characteristics for form fields
        # 1. Enhanced Border Analysis
        border_analysis = self._analyze_enhanced_border(region)
        
        # 2. Background vs Content Analysis  
        content_analysis = self._analyze_background_content_ratio(region)
        
        # 3. Fill Pattern Analysis
        fill_analysis = self._analyze_fill_patterns(region)
        
        # 4. Geometric Analysis
        geometric_analysis = self._analyze_geometric_properties(region, w, h)
        
        # 5. Color/Intensity Distribution Analysis
        intensity_analysis = self._analyze_intensity_distribution(region)
        
        # Store all characteristics
        analysis['characteristics'] = {
            'ocr_classification': 'NO_TEXT_DETECTED',
            'border': border_analysis,
            'content': content_analysis,
            'fill': fill_analysis,
            'geometric': geometric_analysis,
            'intensity': intensity_analysis
        }
        
        # Since no text was detected, evaluate as potential form field
        field_indicators = [
            border_analysis['has_form_border'] * 0.40,          # Very strong indicator
            content_analysis['is_mostly_empty'] * 0.30,         # Key for form fields
            fill_analysis['uniform_background'] * 0.20,         # Form fields are uniform
            geometric_analysis['field_like_shape'] * 0.10       # Shape matters
        ]
        
        # Minimal text scoring since OCR found no text
        text_indicators = [
            0.05 if not content_analysis['is_mostly_empty'] else 0.0  # Slight penalty for non-empty
        ]
        
        field_score = sum(field_indicators)
        text_score = sum(text_indicators)
        
        analysis['field_score'] = field_score
        analysis['text_score'] = text_score
        analysis['confidence'] = abs(field_score - text_score)
        
        # More confident classification since OCR ruled out text
        analysis['is_field'] = field_score > 0.3  # Lower threshold since text is ruled out
        
        return analysis

    def _analyze_enhanced_border(self, region: np.ndarray) -> Dict:
        """Enhanced border analysis focused on form field characteristics."""
        h, w = region.shape
        if h < 6 or w < 6:
            return {'has_form_border': False, 'border_strength': 0}
        
        # Get border and interior regions
        border_width = 2
        top = region[:border_width, :]
        bottom = region[-border_width:, :]
        left = region[:, :border_width]
        right = region[:, -border_width:]
        
        # Interior (avoiding borders)
        interior = region[border_width:-border_width, border_width:-border_width]
        if interior.size == 0:
            interior = region[1:-1, 1:-1]
        
        # Calculate border properties
        border_pixels = np.concatenate([top.flatten(), bottom.flatten(), 
                                      left.flatten(), right.flatten()])
        
        if interior.size == 0:
            return {'has_form_border': False, 'border_strength': 0}
        
        border_mean = np.mean(border_pixels)
        interior_mean = np.mean(interior)
        
        # Form fields typically have dark borders and light interiors
        border_contrast = (interior_mean - border_mean) / 255.0
        
        # Check border consistency (form fields have consistent borders)
        border_consistency = 1.0 - (np.std(border_pixels) / 255.0)
        
        # Form field criteria: dark border, light interior, consistent border
        has_form_border = (
            border_contrast > 0.15 and  # Sufficient contrast
            border_consistency > 0.6 and  # Consistent border
            interior_mean > 200  # Light interior (typical for form fields)
        )
        
        return {
            'has_form_border': has_form_border,
            'border_strength': border_contrast,
            'border_consistency': border_consistency,
            'interior_brightness': interior_mean / 255.0
        }

    def _analyze_background_content_ratio(self, region: np.ndarray) -> Dict:
        """Analyze the ratio of background to content."""
        h, w = region.shape
        
        # Use multiple thresholds to be more robust
        mean_val = np.mean(region)
        
        # For form fields, most pixels should be light (background)
        light_threshold = mean_val + 10  # Lighter than average
        dark_threshold = mean_val - 30   # Much darker than average
        
        light_pixels = np.sum(region > light_threshold)
        dark_pixels = np.sum(region < dark_threshold)
        total_pixels = region.size
        
        light_ratio = light_pixels / total_pixels
        dark_ratio = dark_pixels / total_pixels
        
        # Form fields are mostly light with little dark content
        is_mostly_empty = light_ratio > 0.7 and dark_ratio < 0.15
        high_content_density = dark_ratio > 0.3  # Text areas have more dark pixels
        
        return {
            'light_ratio': light_ratio,
            'dark_ratio': dark_ratio,
            'is_mostly_empty': is_mostly_empty,
            'high_content_density': high_content_density
        }

    def _analyze_fill_patterns(self, region: np.ndarray) -> Dict:
        """Analyze fill patterns to distinguish uniform fields from varied text."""
        h, w = region.shape
        
        # Sample interior region to avoid border effects
        if h > 6 and w > 6:
            interior = region[3:-3, 3:-3]
        else:
            interior = region
        
        if interior.size == 0:
            return {'uniform_background': False}
        
        # Calculate uniformity metrics
        std_dev = np.std(interior)
        mean_val = np.mean(interior)
        
        # Coefficient of variation
        cv = std_dev / mean_val if mean_val > 0 else 1.0
        
        # Form fields have uniform, light backgrounds
        uniform_background = (
            cv < 0.15 and  # Low variation
            mean_val > 180  # Light background
        )
        
        # Additional check: look for horizontal/vertical patterns
        h_projection = np.mean(interior, axis=1)  # Average each row
        v_projection = np.mean(interior, axis=0)  # Average each column
        
        h_variation = np.std(h_projection)
        v_variation = np.std(v_projection)
        
        # Form fields should have low variation in both directions
        low_pattern_variation = h_variation < 15 and v_variation < 15
        
        return {
            'uniform_background': uniform_background and low_pattern_variation,
            'std_dev': std_dev,
            'coefficient_variation': cv,
            'mean_brightness': mean_val / 255.0
        }

    def _analyze_geometric_properties(self, region: np.ndarray, w: int, h: int) -> Dict:
        """Analyze geometric properties that indicate form fields."""
        aspect_ratio = w / h if h > 0 else 0
        
        # Form fields typically have specific aspect ratios
        field_like_shape = (
            2.0 <= aspect_ratio <= 12.0 and  # Rectangular, not too extreme
            w >= 40 and  # Minimum width for input
            h >= 15 and h <= 40  # Reasonable height for single-line input
        )
        
        return {
            'aspect_ratio': aspect_ratio,
            'field_like_shape': field_like_shape,
            'width': w,
            'height': h
        }

    def _analyze_intensity_distribution(self, region: np.ndarray) -> Dict:
        """Analyze intensity distribution patterns."""
        # Calculate histogram
        hist = cv2.calcHist([region], [0], None, [256], [0, 256])
        hist = hist.flatten() / region.size  # Normalize
        
        # Find peaks in histogram
        peak_indices = []
        for i in range(1, len(hist)-1):
            if hist[i] > hist[i-1] and hist[i] > hist[i+1] and hist[i] > 0.01:
                peak_indices.append(i)
        
        # Form fields typically have a strong peak in bright values
        bright_peak = any(peak > 200 for peak in peak_indices)
        dominant_bright = np.sum(hist[200:]) > 0.6  # Most pixels are bright
        
        # Bimodal distribution (typical of form fields with borders)
        is_bimodal = len(peak_indices) == 2 and any(p < 100 for p in peak_indices) and any(p > 200 for p in peak_indices)
        
        return {
            'bright_peak': bright_peak,
            'dominant_bright': dominant_bright,
            'is_bimodal': is_bimodal,
            'num_peaks': len(peak_indices)
        }


def detect_fields_in_document(image_path: str):
    """
    OCR-enhanced field detection - showing only form fields with clear numbering.
    """
    try:
        # Load and preprocess
        original_img = cv2.imread(image_path)
        if original_img is None:
            raise FileNotFoundError(f"Could not load image from {image_path}")

        gray = cv2.cvtColor(original_img, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (3, 3), 0)

        # Step 1: Get all text regions using OCR
        text_boxes = get_text_bounding_boxes(gray)
        
        # Enhanced thresholding
        thresh_adapt = cv2.adaptiveThreshold(
            blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV, 11, 2
        )
        _, thresh_otsu = cv2.threshold(
            blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
        )
        processed_img = cv2.bitwise_or(thresh_adapt, thresh_otsu)

        # Find contours
        contours, _ = cv2.findContours(
            processed_img, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE
        )
        
        # Initialize OCR-enhanced analyzer
        analyzer = OCREnhancedFieldAnalyzer()
        
        form_fields = []
        
        print(f"\nStep 2: Analyzing {len(contours)} detected regions with OCR guidance...", file=sys.stderr)
        
        for i, c in enumerate(contours):
            x, y, w, h = cv2.boundingRect(c)
            area = w * h
            
            if h == 0:
                continue
            aspect_ratio = w / float(h)

            # Basic filters
            if not (MIN_AREA < area < MAX_AREA and
                    w >= MIN_WIDTH and
                    h >= MIN_HEIGHT and
                    aspect_ratio >= ASPECT_RATIO_MIN):
                continue

            # Duplicate check
            is_duplicate = False
            for existing in form_fields:
                bx, by, bw, bh = existing[:4]
                overlap_x = max(0, min(x + w, bx + bw) - max(x, bx))
                overlap_y = max(0, min(y + h, by + bh) - max(y, by))
                overlap_area = overlap_x * overlap_y
                
                if overlap_area > 0.7 * area:
                    is_duplicate = True
                    break
            
            if is_duplicate:
                continue
            
            # OCR-enhanced analysis
            analysis = analyzer.analyze_box_type(gray, x, y, w, h, text_boxes)
            
            # Only keep form fields
            if analysis['is_field']:
                form_fields.append((x, y, w, h, analysis['field_score']))
                print(f"Field {len(form_fields)}: ({x}, {y}, {w}, {h}) - Score: {analysis['field_score']:.3f}", file=sys.stderr)

        # Sort by confidence (highest first)
        form_fields.sort(key=lambda x: x[4], reverse=True)
        
        # Create result image showing only form fields with numbers
        result_img = original_img.copy()
        
        # Draw form fields with clear numbering
        for i, (x, y, w, h, score) in enumerate(form_fields):
            field_number = i + 1
            
            # Draw field box in bright green
            cv2.rectangle(result_img, (x, y), (x + w, y + h), (0, 255, 0), 2)
            
            # Calculate text position (center of the field)
            text_x = x + w // 2
            text_y = y + h // 2
            
            # Choose appropriate font size based on field size
            font_scale = min(w / 100, h / 50, 2.0)  # Adaptive font size
            font_scale = max(font_scale, 0.8)  # Minimum size
            
            # Get text size to center it properly
            text = str(field_number)
            (text_w, text_h), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, 3)
            
            # Adjust text position to center it
            text_x = text_x - text_w // 2
            text_y = text_y + text_h // 2
            
            # Draw white background circle for better visibility
            circle_radius = max(text_w, text_h) // 2 + 8
            cv2.circle(result_img, (x + w // 2, y + h // 2), circle_radius, (255, 255, 255), -1)
            cv2.circle(result_img, (x + w // 2, y + h // 2), circle_radius, (0, 0, 0), 2)
            
            # Draw the number in black
            cv2.putText(result_img, text, (text_x, text_y),
                       cv2.FONT_HERSHEY_SIMPLEX, font_scale, (0, 0, 0), 3)

        print(f"\n=== FINAL RESULTS ===", file=sys.stderr)
        print(f"Form Fields Found: {len(form_fields)}", file=sys.stderr)
        for i, (x, y, w, h, score) in enumerate(form_fields):
            print(f"  Field {i+1}: Position({x}, {y}), Size({w}x{h}), Score: {score:.3f}", file=sys.stderr)

        # Display results
        plt.figure(figsize=(16, 10))
        
        plt.subplot(1, 2, 1)
        plt.imshow(cv2.cvtColor(original_img, cv2.COLOR_BGR2RGB))
        plt.title('Original Image')
        plt.axis('off')

        plt.subplot(1, 2, 2)
        plt.imshow(cv2.cvtColor(result_img, cv2.COLOR_BGR2RGB))
        plt.title(f'Detected Form Fields (Total: {len(form_fields)})')
        plt.axis('off')

        plt.tight_layout()
        plt.show()
        
        return form_fields

    except Exception as e:
        print(f"An error occurred: {e}", file=sys.stderr)
        return []


def get_bounding_boxes(image_path):
    """
    OCR-enhanced field detection - showing only form fields with clear numbering.
    """
    print("Starting OCR-Enhanced Field Detection with Clear Numbering...", file=sys.stderr)
    # Load and preprocess
    original_img = cv2.imread(image_path)
    if original_img is None:
        raise FileNotFoundError(f"Could not load image from {image_path}")

    gray = cv2.cvtColor(original_img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)

    # Step 1: Get all text regions using OCR
    text_boxes = get_text_bounding_boxes(gray)
    
    # Enhanced thresholding
    thresh_adapt = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, 11, 2
    )
    _, thresh_otsu = cv2.threshold(
        blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
    )
    processed_img = cv2.bitwise_or(thresh_adapt, thresh_otsu)

    # Find contours
    contours, _ = cv2.findContours(
        processed_img, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE
    )
    
    # Initialize OCR-enhanced analyzer
    analyzer = OCREnhancedFieldAnalyzer()
    
    form_fields = []
    
    print(f"\nStep 2: Analyzing {len(contours)} detected regions with OCR guidance...", file=sys.stderr)
    
    for i, c in enumerate(contours):
        x, y, w, h = cv2.boundingRect(c)
        area = w * h
        
        if h == 0:
            continue
        aspect_ratio = w / float(h)

        # Basic filters
        if not (MIN_AREA < area < MAX_AREA and
                w >= MIN_WIDTH and
                h >= MIN_HEIGHT and
                aspect_ratio >= ASPECT_RATIO_MIN):
            continue

        # Duplicate check
        is_duplicate = False
        for existing in form_fields:
            bx, by, bw, bh = existing[:4]
            overlap_x = max(0, min(x + w, bx + bw) - max(x, bx))
            overlap_y = max(0, min(y + h, by + bh) - max(y, by))
            overlap_area = overlap_x * overlap_y
            
            if overlap_area > 0.7 * area:
                is_duplicate = True
                break
        
        if is_duplicate:
            continue
        
        # OCR-enhanced analysis
        analysis = analyzer.analyze_box_type(gray, x, y, w, h, text_boxes)
        
        # Only keep form fields
        if analysis['is_field']:
            form_fields.append((x, y, w, h, analysis['field_score']))
            print(f"Field {len(form_fields)}: ({x}, {y}, {w}, {h}) - Score: {analysis['field_score']:.3f}", file=sys.stderr)

    # Sort by confidence (highest first)
    form_fields.sort(key=lambda x: x[4], reverse=True)
    result_img = original_img.copy()
    return form_fields, original_img





def get_image_with_boxes(form_fields, result_img):
    """
    Field labeling with small boxed numbers centered INSIDE each field
    """
    for i, (x, y, w, h, score) in enumerate(form_fields):
        field_number = i + 1
        
        # Draw field box in bright green
        cv2.rectangle(result_img, (x, y), (x + w, y + h), (0, 255, 0), 2)
        
        # Small boxed number at center of field
        label_text = str(field_number)
        
        # Calculate top-right corner position INSIDE the field
        corner_x = x + w - 15  # 15 pixels from right edge
        corner_y = y + 15      # 15 pixels from top edge
        
        # Small font for minimal interference
        font_scale = 0.4
        thickness = 1
        
        # Get text dimensions
        (text_w, text_h), baseline = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)
        
        # Calculate small box dimensions
        box_width = text_w + 6
        box_height = text_h + 6
        
        # Calculate box position (top-right corner)
        box_x = corner_x - box_width
        box_y = corner_y - box_height // 2
        
        # Draw small white box with black border

        
        # Calculate text position within the box (top-right corner)
        text_x = corner_x - text_w - 3
        text_y = corner_y + text_h // 2
        
        # Draw the number in black
        cv2.putText(result_img, label_text, (text_x, text_y), 
                   cv2.FONT_HERSHEY_SIMPLEX, font_scale, (0, 0, 0), thickness)
    cv2.imshow("Form Fields with Sequential Numbering", result_img)
    cv2.waitKey(0)
    return result_img


# def main():
#     image_file_path = "Screenshot.png"  # Replace with your image file path
    
#     print("Starting Form Field Detection with Clear Numbering...")
#     print("This will:")
#     print("1. Use OCR to identify text regions")
#     print("2. Detect form fields using visual analysis")
#     print("3. Display ONLY form fields with clear numbers inside")
    
#     fields  , to_be_drawn_image= get_bounding_boxes_from_image(image_file_path)
#     numbered_boxes_image = get_image_with_boxes(fields , to_be_drawn_image)
#     plt.imshow(numbered_boxes_image)
#     plt.show()
#     if fields:
#         print(f"\nSuccessfully detected {len(fields)} form fields!")
#     else:
#         print("\nNo form fields were detected.")


# if __name__ == "__main__":
#     main()