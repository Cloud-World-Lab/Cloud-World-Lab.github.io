"""Read-only reachability audit of public links in the generated website."""
import concurrent.futures
import json
import time
import urllib.error
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = set()
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "a" and attrs.get("href", "").startswith("https://"):
            self.urls.add(attrs["href"])

def check(url):
    for method in ["HEAD", "GET"]:
        try:
            request = urllib.request.Request(url, method=method, headers={"User-Agent": "CloudWorldLab-LinkCheck/1.0"})
            with urllib.request.urlopen(request, timeout=18) as response:
                return {"url": url, "status": response.status, "final_url": response.url, "method": method}
        except urllib.error.HTTPError as error:
            if method == "HEAD" and error.code in [403, 405, 429]:
                continue
            return {"url": url, "status": error.code, "method": method}
        except Exception as error:
            return {"url": url, "status": "unverified", "error": type(error).__name__, "method": method}

links = Links()
links.feed((ROOT / "index.html").read_text())
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    results = list(pool.map(check, sorted(links.urls)))
report = {"checked_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "results": results}
(ROOT / "qa" / "external-links.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
counts = {}
for result in results:
    key = str(result["status"])
    counts[key] = counts.get(key, 0) + 1
print(json.dumps({"links": len(results), "statuses": counts}, ensure_ascii=False))
for result in results:
    if result["status"] != 200:
        print(json.dumps(result, ensure_ascii=False))
