from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import json,base64
class Handler(SimpleHTTPRequestHandler):
 def do_POST(self):
  if self.path.startswith('/qa-frame-batch/') and self.path.split('/')[-1].isdigit():
   folder=Path('artifacts/characters/frames');folder.mkdir(exist_ok=True);start=int(self.path.split('/')[-1]);frames=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
   for i,frame in enumerate(frames):(folder/(str(start+i).zfill(5)+'.jpg')).write_bytes(base64.b64decode(frame))
   self.send_response(200);self.end_headers();return
  if self.path.startswith('/qa-frame/') and self.path.split('/')[-1].isdigit():
   folder=Path('artifacts/characters/frames');folder.mkdir(exist_ok=True);data=self.rfile.read(int(self.headers['Content-Length']));(folder/(self.path.split('/')[-1].zfill(5)+'.jpg')).write_bytes(data);self.send_response(200);self.end_headers();return
  if self.path not in ['/qa-recording','/qa-report']: self.send_error(404);return
  data=self.rfile.read(int(self.headers['Content-Length']));out=Path('artifacts/characters')/('movement-review.webm' if self.path=='/qa-recording' else 'browser-report.json');out.write_bytes(data);self.send_response(200);self.end_headers();self.wfile.write(b'ok')
ThreadingHTTPServer(('127.0.0.1',8765),Handler).serve_forever()
