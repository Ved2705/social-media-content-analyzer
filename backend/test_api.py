import urllib.request
import urllib.error
import io
import json
from PIL import Image

# Create dummy image
img = Image.new('RGB', (100, 100), color = 'white')
img_byte_arr = io.BytesIO()
img.save(img_byte_arr, format='JPEG')
img_bytes = img_byte_arr.getvalue()

boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
body = (
    b'--' + boundary.encode() + b'\r\n'
    b'Content-Disposition: form-data; name="file"; filename="test.jpg"\r\n'
    b'Content-Type: image/jpeg\r\n\r\n' +
    img_bytes + b'\r\n'
    b'--' + boundary.encode() + b'--\r\n'
)

req = urllib.request.Request(
    'http://localhost:8000/api/extract',
    data=body,
    headers={
        'Content-Type': f'multipart/form-data; boundary={boundary}'
    }
)

try:
    with urllib.request.urlopen(req) as response:
        print(response.status)
        print(response.read().decode())
except urllib.error.HTTPError as e:
    print(e.code)
    print(e.read().decode())
