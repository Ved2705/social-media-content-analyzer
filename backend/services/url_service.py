import re
import urllib.request
import urllib.error
from urllib.parse import urlparse

def convert_to_direct_url(url: str) -> str:
    """
    Converts common cloud storage share URLs to direct download URLs.
    Supports Google Drive and Dropbox.
    """
    # Google Drive
    # Match: https://drive.google.com/file/d/FILE_ID/view...
    gdrive_match = re.match(r"https?://drive\.google\.com/file/d/([^/]+)/.*", url)
    if gdrive_match:
        file_id = gdrive_match.group(1)
        return f"https://drive.google.com/uc?export=download&id={file_id}"

    # Dropbox
    # Match: https://www.dropbox.com/s/FILE_ID/filename?dl=0
    if "dropbox.com" in url:
        return url.replace("dl=0", "dl=1")

    # Return as-is for direct URLs
    return url

def download_file_from_url(url: str) -> tuple[bytes, str]:
    """
    Downloads a file from a URL and returns its contents and content type.
    """
    direct_url = convert_to_direct_url(url)
    
    req = urllib.request.Request(
        direct_url, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
    )
    
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            contents = response.read()
            content_type = response.headers.get_content_type()
            
            # Google Drive sometimes returns HTML (e.g. if file is too large for virus scan or requires auth)
            # But for public files < 100MB, it usually works.
            # We will rely on the content type check in main.py to reject HTML pages.
            
            return contents, content_type
    except urllib.error.URLError as e:
        raise Exception(f"Failed to download file: {str(e)}")
