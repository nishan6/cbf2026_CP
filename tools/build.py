"""Build dist/index.html (client view, deployed) and build/team.html (full team view)."""
import os, re, sys
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
plan = os.path.join(R, 'data', 'plan.json')
rd = lambda p: open(os.path.join(R, p), encoding='utf-8').read()
def build(client):
    html = rd('src/index.html')
    logo = rd('assets/hmbl-logo.svg').replace('<svg ', '<svg role="img" aria-label="HMBL Entertainment" ', 1)
    html = html.replace('/*__CSS__*/', rd('src/app.css')).replace('<!--__LOGO__-->', logo)
    html = html.replace('/*__PLAN__*/', 'window.PLAN=' + open(plan, encoding='utf-8').read().replace('</', '<\\/') + ';')
    proj = rd('src/project.js')
    if client:  # internal questions never reach the client page
        proj = "window.CLIENT_VIEW = true;\n" + proj
    elif os.path.exists(os.path.join(R, 'src', 'internal.js')):
        proj = rd('src/internal.js') + "\n" + proj
    html = html.replace('/*__PROJECT__*/', proj).replace('/*__APP__*/', rd('src/app.js'))
    out = os.path.join(R, 'dist', 'index.html') if client else os.path.join(R, 'build', 'team.html')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, 'w', encoding='utf-8').write(html)
    print(os.path.relpath(out, R), len(html.encode()) // 1024, 'KB')
build(True)
if os.path.exists(os.path.join(R, 'src', 'internal.js')): build(False)
