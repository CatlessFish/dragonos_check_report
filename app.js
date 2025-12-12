const express = require('express');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const os = require('os');

const app = express();
const PORT = 3000;

// 设置模板引擎
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 静态文件服务
app.use(express.static('public'));

// 读取当前 app.js 同级目录下的 dragon_bugs 目录
const DRAGON_BUGS_PATH = path.join(__dirname, 'dragon_bugs');

// 读取函数名
const FuncFile = path.join(DRAGON_BUGS_PATH, 'func_names');
if (!fs.existsSync(FuncFile)) console.error('Error reading func_names:', err);
const raw = fs.readFileSync(FuncFile, { encoding: 'utf8' });
const FUNC_NAME_LINES = raw.split(/\r?\n/);

// 辅助函数：从文件名提取序号
function extractNumber(filename) {
  const match = filename.match(/^(\d+)\.(log|mir)$/);
  return match ? parseInt(match[1]) : null;
}

// 辅助函数：从序号提取函数名
function getFunctionNameByNumber(num) {  
  return FUNC_NAME_LINES[num - 1] ? FUNC_NAME_LINES[num - 1].trim() : null;
}



// 获取所有文件并按序号分组
async function getFileGroups() {
  try {
    const files = await fsp.readdir(DRAGON_BUGS_PATH);
    const groups = {};

    for (const file of files) {
      const num = extractNumber(file);
      if (num !== null) {
        if (!groups[num]) groups[num] = {};
        const ext = file.endsWith('.log') ? 'log' : 'mir';
        groups[num][ext] = file;
      }
    }

    return Object.entries(groups)
      .sort(([a], [b]) => a - b)
      .map(([num, files]) => ({
        number: parseInt(num),
        logFile: files.log,
        mirFile: files.mir
      }));
  } catch (error) {
    console.error('Error reading directory:', error);
    return [];
  }
}

// 读取文件内容
async function readFileContent(filename) {
  try {
    const filePath = path.join(DRAGON_BUGS_PATH, filename);
    return await fsp.readFile(filePath, 'utf-8');
  } catch (error) {
    return `Error reading file: ${error.message}`;
  }
}

// 首页路由 - 显示所有序号
app.get('/', async (req, res) => {
  try {
    const fileGroups = await getFileGroups();
    res.render('index', { fileGroups, FUNC_NAME_LINES });
  } catch (error) {
    res.status(500).send('Error loading directory');
  }
});

// 子页面路由
app.get('/page/:number', async (req, res) => {
  try {
    const number = parseInt(req.params.number);
    const fileGroups = await getFileGroups();
    const fileGroup = fileGroups.find(g => g.number === number);

    if (!fileGroup) {
      return res.status(404).send('Page not found');
    }

    const functionName = getFunctionNameByNumber(number);
    // console.log("Loading entry:", number, "func name:", functionName);


    const [logContent, mirContent] = await Promise.all([
      fileGroup.logFile ? readFileContent(fileGroup.logFile) : null,
      fileGroup.mirFile ? readFileContent(fileGroup.mirFile) : null
    ]);

    res.render('page', {
      number,
      functionName,
      logContent,
      mirContent,
      hasLog: !!logContent,
      hasMir: !!mirContent
    });
  } catch (error) {
    res.status(500).send('Error loading page');
  }
});


// 启动服务器
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Reading from: ${DRAGON_BUGS_PATH}`);
});
