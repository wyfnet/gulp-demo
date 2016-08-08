var gulp = require("gulp"),
    gutil = require("gulp-util"),
    del = require("del"),
    sass = require("gulp-sass"),
    uglify = require('gulp-uglify'),
    rename = require("gulp-rename"),
    browserSync = require("browser-sync").create(),
    reload = browserSync.reload,
    sequence = require("run-sequence"),
    plumber = require("gulp-plumber"),
    watch = require("gulp-watch"),
    through2 = require("through2"),
    path = require("path")
    fs = require("fs");


// #############################################
// # init params

// 收集参数
var cwd = process.cwd();
var cmdargs = process.argv.slice(2);
var cmdname = cmdargs.shift();
var cmdopts = {};
var srcpath = "./src";
var distpath = "./dist";

while (cmdargs.length) {
	var key = cmdargs.shift().slice(2);
	var val = cmdargs.shift();
	cmdopts[key] = key === "src" || key === "dist" ? normalizePath(val) : val;
}

// 参数配置
var release = cmdname === "release";
var reloadTimer = null;
var devport = 5678;
var paths = {
	src: path.join(__dirname, srcpath),
	dist: path.join(__dirname, distpath)
}

function normalizePath(url) {
	if (url.charAt(0) === "/" || url.indexOf(":") > -1) {
		return path.normalize(url);
	}
	return path.normalize(path.join(cwd, url));
}

function setOptions(cmd, cmdopts) {
	if (cmd === "start") {
		paths.src = cmdopts.src ? path.join(cmdopts.src, srcpath) : paths.src;
	} else if (cmd === "release") {
		paths.src = cmdopts.src ? path.join(cmdopts.src, srcpath) : paths.src;
		paths.dist = cmdopts.dist ? cmdopts.dist : path.normalize(paths.src + "/../" + distpath);
	}
}

function showUsage() {
	console.log("Usage:\n");
	console.log("     gulp                   显示帮助");
	console.log("     gulp help              显示帮助");
	console.log("     gulp start --src src   在--src目录下自动化开发调试环境");
	console.log("     gulp release --src src --dist dist 构建--src线上版本到--dist目录\n");
	console.log("     gulp start --src src --proxy localhost   使用gulp代理localhost请求，并且实时监听src文件修改");
}

// #############################################
// # default tasks

// # clean path
gulp.task("clean:dist", function () {
	return del([paths.dist], {force: true});
});

// # 编译css
gulp.task("sass", function() {
	var base = paths.src;
	var dest = base;
	return gulp.src(base + "/**/*.scss", {base: base})
		.pipe(plumber())
		.pipe(sass({
			precision: 2,
			outputStyle: release ? "compressed" : "expanded"
			//sourceComments: release ? false : true
		})
		.on("error", sass.logError))
		.pipe(gulp.dest(dest));
});


// # 压缩js
gulp.task("uglify", function() {
	var base = paths.src;
	var dest = paths.dist;
	return gulp.src(base + "/**/*.js", {base: base})
		.pipe(plumber())
		.pipe(uglify())
		.pipe(gulp.dest(dest));
});

// # 复制静态资源
gulp.task("copy:dist", function() {
	var base = paths.src;
	var dest = paths.dist;
	return gulp.src([
			base + "/**/*",
			"!" + base + "/**/*.js",
			"!" + base + "/**/*.scss"
		], {base: base})
		.pipe(gulp.dest(dest));
});


// # serv & watch
gulp.task("server", function() {
	// start server
	browserSync.init({
		ui: false,
		notify: false,
		port: devport,
		// 设置代理请求
		proxy: cmdopts.proxy,
		server: !cmdopts.proxy ? {
			baseDir: paths.src
		} : false
	});

	// # watch src资源, 调用相关任务预处理
	watch(paths.src + "/**/*.scss", function(obj) {
		sequence("sass");
	});

	// # 刷新浏览器
	// # 限制浏览器刷新频率
	watch(paths.src + "/**/*", function(obj) {
		var url = obj.path.replace(/\\/g, "/");
		var absurl = url;
		url = path.relative(paths.src, url);
		console.log("[KS] " + absurl);

		// skip scss
		if (!/\.scss$/.test(url)) {
			if (reloadTimer) {
				clearTimeout(reloadTimer);
			}
			reloadTimer = setTimeout(reload, 1000);
		}
	});
});


// #############################################
// # public task

gulp.task("default", showUsage);
gulp.task("help", showUsage);

gulp.task("start", function(cb) {
	release = false;
	setOptions("start", cmdopts);
	sequence("sass", "server", cb);
});

gulp.task("release", function(cb) {
	release = true;
	setOptions("release", cmdopts);
	sequence("clean:dist", ["sass", "uglify"], "copy:dist", cb);
});
