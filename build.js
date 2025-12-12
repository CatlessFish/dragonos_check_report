const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");
const ejs = require("ejs");

const DRAGON_BUGS_PATH = path.join(__dirname, "dragon_bugs");
const VIEWS_PATH = path.join(__dirname, "views");
const PUBLIC_PATH = path.join(__dirname, "public");
const DIST_PATH = path.join(__dirname, "dist");

// 读取 func_names
const FUNC_FILE = path.join(DRAGON_BUGS_PATH, 'func_names');
const FUNC_NAME_LINES = fs.readFileSync(FUNC_FILE, "utf8").split(/\r?\n/);

// 提取文件数字
function extractNumber(filename) {
    const m = filename.match(/^(\d+)\.(log|mir)$/);
    return m ? Number(m[1]) : null;
}

// 根据数字获取函数名
function getFunctionNameByNumber(n) {
    return FUNC_NAME_LINES[n - 1] ? FUNC_NAME_LINES[n - 1].trim() : null;
}

// 获取所有 bug 文件组
async function getFileGroups() {
    const files = await fsp.readdir(DRAGON_BUGS_PATH);
    const groups = {};

    for (const file of files) {
        const id = extractNumber(file);
        if (!id) continue;

        if (!groups[id]) groups[id] = {};
        const ext = file.endsWith(".log") ? "log" : "mir";
        groups[id][ext] = file;
    }

    return Object.entries(groups)
        .sort(([a], [b]) => a - b)
        .map(([number, obj]) => ({
            number: Number(number),
            logFile: obj.log,
            mirFile: obj.mir
        }));
}

// 读取文件内容
async function readFileContent(filename) {
    return await fsp.readFile(path.join(DRAGON_BUGS_PATH, filename), "utf8");
}

// ⭐ 自动替换模板中的 /style.css 为正确的静态路径
function fixCssPath(html, isSubPage) {
    if (isSubPage) {
        return html.replace('/style.css', '../../style.css');
    } else {
        return html.replace('/style.css', './style.css');
    }
}

async function build() {
    // 清空 dist
    if (fs.existsSync(DIST_PATH)) fs.rmSync(DIST_PATH, { recursive: true });
    await fsp.mkdir(DIST_PATH);

    // 复制 style.css 到 dist 根目录
    fs.copyFileSync(
        path.join(PUBLIC_PATH, "style.css"),
        path.join(DIST_PATH, "style.css")
    );

    const fileGroups = await getFileGroups();

    // ---------- 首页 ----------
    const indexTemplate = fs.readFileSync(path.join(VIEWS_PATH, "index.ejs"), "utf8");

    let indexHTML = ejs.render(indexTemplate, {
        fileGroups,
        FUNC_NAME_LINES
    });

    indexHTML = fixCssPath(indexHTML, false);

    await fsp.writeFile(path.join(DIST_PATH, "index.html"), indexHTML);



    // ---------- 子页面 ----------
    const pageTemplate = fs.readFileSync(path.join(VIEWS_PATH, "page.ejs"), "utf8");

    for (const group of fileGroups) {
        const logContent = group.logFile ? await readFileContent(group.logFile) : "";
        const mirContent = group.mirFile ? await readFileContent(group.mirFile) : "";

        let pageHTML = ejs.render(pageTemplate, {
            number: group.number,
            functionName: getFunctionNameByNumber(group.number),
            logContent,
            mirContent,
            hasLog: !!logContent,
            hasMir: !!mirContent
        });

        pageHTML = fixCssPath(pageHTML, true);

        const dir = path.join(DIST_PATH, "page", String(group.number));
        await fsp.mkdir(dir, { recursive: true });
        await fsp.writeFile(path.join(dir, "index.html"), pageHTML);
    }

    console.log("✔ Build complete. Static site generated in dist/");
}

build();
