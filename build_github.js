/**
 * GitHub Pages Static Build Script
 * - 不修改原始模板内容
 * - 在 dist/ 基础上复制到 dist-github/
 * - 自动修正所有 HTML 中的绝对路径 /xxxx → ./xxxx
 */

const fs = require("fs");
const path = require("path");

const DIST_PATH = path.join(__dirname, "dist");
const OUTPUT_PATH = path.join(__dirname, "dist-github");

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function fixHtmlPaths(filePath) {
    let html = fs.readFileSync(filePath, "utf8");

    // 将 href="/xxx" 改成 href="./xxx"
    html = html.replace(/(href|src)="\/([^"]+)"/g, (match, attr, p2) => {
        return `${attr}="./${p2}"`;
    });

    // 修复 <a href="/"> 返回目录（仅在 page/x/index.html 才应该修改）
    if (filePath.includes(`${path.sep}page${path.sep}`)) {
        html = html.replace(
            /<a\s+href="\/"\s+class="back-link">/g,
            `<a href="../../index.html" class="back-link">`
        );
    }

    fs.writeFileSync(filePath, html);
}

function processHtmlRecursive(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            processHtmlRecursive(fullPath);
        } else if (entry.name.endsWith(".html")) {
            fixHtmlPaths(fullPath);
        }
    }
}

function main() {
    if (!fs.existsSync(DIST_PATH)) {
        console.error("❌ dist not found. Run `npm run build` first.");
        process.exit(1);
    }

    // 清空 dist-github
    if (fs.existsSync(OUTPUT_PATH)) {
        fs.rmSync(OUTPUT_PATH, { recursive: true });
    }

    // 复制 dist → dist-github
    copyDir(DIST_PATH, OUTPUT_PATH);

    // 处理所有 HTML 路径
    processHtmlRecursive(OUTPUT_PATH);

    console.log("🎉 GitHub Pages build complete! Output:", OUTPUT_PATH);
}

main();
