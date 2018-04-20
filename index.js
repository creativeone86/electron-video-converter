const electron = require('electron');
const {app, BrowserWindow, ipcMain, shell} = electron;
const ffmpeg = require('fluent-ffmpeg');
const _ = require('lodash');

let mainWindow = null;

app.on('ready', () => {
	mainWindow = new BrowserWindow({
		height: 600,
		width: 800,
		webPreferences: {
			backgroundThrottling: false
		}
	});

	mainWindow.loadURL(`file://${__dirname}/src/index.html`);
});

ipcMain.on('videos:added', (e, videos) => {
	const promises = _.map(videos, video => {
		return new Promise((resolve, reject) => {
			ffmpeg.ffprobe(video.path, (err, metaData) => {
				video.duration = metaData.format.duration;
				video.format = 'avi';
				resolve(video);
			})
		})
	});

	Promise.all(promises)
		.then((results) => {
			mainWindow.webContents.send('metadata:complete', results);
		})

});

ipcMain.on('conversion:start', (e, videos) => {
	_.each(videos, (video) => {
		const outputDir = video.path.split(video.name)[0];
		const outputFileName = video.name.split('.')[0];
		const outputPath = `${outputDir}${outputFileName}-converted.${video.format}`;

		ffmpeg(video.path)
			.output(outputPath)
			.on('progress', ({timemark}) => {
				mainWindow.webContents.send('conversion:progress', {video, timemark})
			})
			.on('end', () => {
				mainWindow.webContents.send(
					'conversion:end',
					{video, outputPath}
				);
			})
			.run();
	});

});

ipcMain.on('folder:open', (e, {outputPath}) => {
	shell.showItemInFolder(outputPath);
});