import os
import json
import requests
from bs4 import BeautifulSoup
from http.server import SimpleHTTPRequestHandler, HTTPServer
from urllib.parse import unquote

class CustomHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/videos':
            try:
                texts_dir = os.path.normpath(os.path.join(os.getcwd(), 'texts'))
                print(f"Checking texts directory: {texts_dir}")
                if not os.path.exists(texts_dir):
                    print(f"Directory {texts_dir} does not exist")
                    self.send_response(500)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(json.dumps({'error': 'Texts directory not found'}).encode('utf-8'))
                    return

                folders = [f for f in os.listdir(texts_dir) if os.path.isdir(os.path.join(texts_dir, f))]
                print(f"Found folders: {folders}")
                videos = []
                for folder in folders:
                    try:
                        if not folder or not isinstance(folder, str):
                            print(f"Skipping invalid folder name: {folder}")
                            continue
                        url = f'https://www.youtube.com/watch?v={folder}'
                        response = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=5)
                        title = f'New French Learning Video ({folder})'
                        if response.ok:
                            soup = BeautifulSoup(response.text, 'html.parser')
                            meta_title = soup.find('meta', {'name': 'title'})
                            if meta_title and meta_title['content']:
                                title = meta_title['content']
                            print(f"Fetched title for {folder}: {title}")
                        else:
                            print(f"Failed to fetch title for {folder}: HTTP {response.status_code}")
                        videos.append({'id': folder, 'title': title})
                    except Exception as e:
                        print(f"Error processing folder {folder}: {e}")
                        videos.append({'id': folder, 'title': f'New French Learning Video ({folder})'})
                print(f"Sending videos: {videos}")
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(videos).encode('utf-8'))
            except Exception as e:
                print(f"Error in /api/videos: {e}")
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
        else:
            # Handle file serving with case-insensitive paths
            try:
                path = unquote(self.path).lstrip('/')
                full_path = os.path.normpath(os.path.join(os.getcwd(), path))
                print(f"Serving file: {full_path}")
                if os.path.exists(full_path):
                    super().do_GET()
                else:
                    print(f"File not found: {full_path}")
                    self.send_response(404)
                    self.send_header('Content-Type', 'text/plain')
                    self.end_headers()
                    self.wfile.write(b'File not found')
            except Exception as e:
                print(f"Error serving file {self.path}: {e}")
                self.send_response(500)
                self.send_header('Content-Type', 'text/plain')
                self.end_headers()
                self.wfile.write(f"Error: {str(e)}".encode('utf-8'))

def run(server_class=HTTPServer, handler_class=CustomHandler, port=8000):
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print(f'Serving on http://localhost:{port}')
    httpd.serve_forever()

if __name__ == '__main__':
    run()