import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def create_mac_screenshot(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    w, h = img.size

    # Window settings
    title_height = 38
    padding = 40
    corner_radius = 12

    window_w = w
    window_h = h + title_height

    canvas_w = window_w + padding * 2
    canvas_h = window_h + padding * 2

    # Canvas with modern subtle dark/tech background
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (13, 17, 23, 255)) # #0D1117

    # Create window composite
    window = Image.new("RGBA", (window_w, window_h), (0, 0, 0, 0))

    # Titlebar background
    titlebar = Image.new("RGBA", (window_w, title_height), (22, 27, 34, 255)) # #161B22
    draw_tb = ImageDraw.Draw(titlebar)

    # Add macOS control dots
    dots = [
        ("#FF5F56", 16), # Red
        ("#FFBD2E", 34), # Yellow
        ("#27C93F", 52), # Green
    ]
    dot_r = 6
    dot_y = title_height // 2
    for color, dot_x in dots:
        draw_tb.ellipse(
            [dot_x - dot_r, dot_y - dot_r, dot_x + dot_r, dot_y + dot_r],
            fill=color
        )

    # Titlebar text
    title_text = "QWOANG AI Dev Guardian — Authentication & Web Dashboard"
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 12)
    except Exception:
        font = ImageFont.load_default()

    # Draw centered title text
    bbox = draw_tb.textbbox((0, 0), title_text, font=font)
    text_w = bbox[2] - bbox[1]
    text_x = (window_w - text_w) // 2
    text_y = (title_height - (bbox[3] - bbox[1])) // 2
    draw_tb.text((text_x, text_y), title_text, fill=(139, 148, 158, 255), font=font)

    # Titlebar bottom border line
    draw_tb.line([(0, title_height - 1), (window_w, title_height - 1)], fill=(48, 54, 61, 255), width=1)

    # Assemble window (Titlebar + Screenshot)
    window.paste(titlebar, (0, 0))
    window.paste(img, (0, title_height))

    # Create rounded corner mask for window
    mask = Image.new("L", (window_w, window_h), 0)
    draw_mask = ImageDraw.Draw(mask)
    draw_mask.rounded_rectangle([0, 0, window_w, window_h], corner_radius, fill=255)

    # Apply mask to window
    rounded_window = Image.new("RGBA", (window_w, window_h), (0, 0, 0, 0))
    rounded_window.paste(window, (0, 0), mask)

    # Create drop shadow
    shadow_pad = 20
    shadow_img = Image.new("RGBA", (window_w + shadow_pad * 2, window_h + shadow_pad * 2), (0, 0, 0, 0))
    draw_shadow = ImageDraw.Draw(shadow_img)
    draw_shadow.rounded_rectangle(
        [shadow_pad, shadow_pad + 4, shadow_pad + window_w, shadow_pad + window_h + 4],
        corner_radius,
        fill=(0, 0, 0, 160)
    )
    shadow_blurred = shadow_img.filter(ImageFilter.GaussianBlur(16))

    # Paste shadow then window on canvas
    canvas.paste(shadow_blurred, (padding - shadow_pad, padding - shadow_pad), shadow_blurred)
    canvas.paste(rounded_window, (padding, padding), rounded_window)

    # Save output image
    canvas.save(output_path, "PNG")
    print(f"Successfully generated macOS styled screenshot at {output_path}")

if __name__ == "__main__":
    inp = sys.argv[1] if len(sys.argv) > 1 else "/home/quangdm10/.gemini/antigravity/brain/07d93401-6ace-4292-ba8d-106ef1e8e31d/media__1786693956300.png"
    outp = sys.argv[2] if len(sys.argv) > 2 else "img/dashboard-mac.png"
    create_mac_screenshot(inp, outp)
