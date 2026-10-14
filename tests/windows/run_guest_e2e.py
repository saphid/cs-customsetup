"""Run guest-e2e.ps1 in the dedicated Windows test VM through its relay client.

usage: python3 run_guest_e2e.py CODE_A CODE_B [--client PATH] [--out FILE]
The VM must reach the CS Setup server at http://10.0.2.2:18431 (see README).
"""
import argparse, base64, json, subprocess, sys
from pathlib import Path

here = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('code_a'); parser.add_argument('code_b')
parser.add_argument('--client', default=str(Path.home() / 'projects/skills/t3-computer-use/scripts/windows/client.py'))
parser.add_argument('--out', default='/tmp/cssetup-vm/e2e.json')
args = parser.parse_args()

encoded = base64.b64encode((here / 'guest-e2e.ps1').read_bytes()).decode()
script = (f"$p=Join-Path $env:TEMP 'guest-e2e.ps1'; [IO.File]::WriteAllBytes($p,[Convert]::FromBase64String('{encoded}')); "
          f"& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $p -CodeA {args.code_a} -CodeB {args.code_b} 2>&1 | Out-String")
done = subprocess.run([sys.executable, args.client, 'inspect', '-', '--out', args.out],
                      input=json.dumps({'script': script}), text=True, capture_output=True, timeout=300)
if done.returncode:
    sys.exit(done.stderr or done.stdout)
reply = json.loads(Path(args.out).read_text())
try:
    report = json.loads(reply['stdout'])
except (KeyError, ValueError):
    sys.exit(f"guest did not return a report:\n{reply.get('stdout', '')}\n{reply.get('stderr', '')}")
for name, result in report['results'].items():
    print(('PASS ' if result['ok'] else 'FAIL ') + name + ('' if result['ok'] else '\n     ' + result['detail'][:400].replace('\n', '\n     ')))
print(f"guest mouse restored: {report['guestMouseRestored']}")
print('ALL PASSED' if report['passed'] else 'FAILURES')
sys.exit(0 if report['passed'] else 1)
