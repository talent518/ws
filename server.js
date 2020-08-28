require('dotenv').config('./env');

const express = require('express');
const app = express();
const IO = require('socket.io');
const Redis = require('ioredis');
const redis = new Redis({
	host: process.env.REDIS_HOST || '127.0.0.1', // Redis host
	port: process.env.REDIS_PORT || 6379, // Redis port
	family: process.env.REDIS_FAMILY || 4, // 4 (IPv4) or 6 (IPv6)
	password: process.env.REDIS_PASSWORD || '',
	db: process.env.REDIS_DB || 0,
});
const moment = require("moment");
const cookieParser = require('cookie-parser');
const logger = require('morgan');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static('public'));
app.post('/send', function(req, res) {
	const room = req.body.room;
	const name = req.body.name;
	const message = req.body.message;
	io.to(room).emit('chat', {name,message});
	res.send('已发送');
	res.end();
});

app.set('port', process.env.PORT || 6001);
const http = require('http');
const server = http.createServer(app);
server.listen(6001, function() {
	console.log('Server is running!');
});

const io = IO(server);

io.on('connection', function(socket) {
	// socket.compress(false).send('Hello world!');
	socket.on('disconnect', function() {
		console.log(socket.name + ' leave room ' + socket.room);
		io.to(socket.room).emit('leave', socket.name);
		socket.leave(socket.room);
	});
	socket.on('join', function(join) {
		console.log(join.name, 'join', join.room);
		socket.join(join.room);
		
		socket.name = join.name;
		socket.room = join.room;
		io.to(socket.room).emit('join', socket.name);
	});
	socket.on('message', function(message) {
		console.log('Receive message:', message);
		socket.send(message);
	});
	socket.on('time', function() {
		const t = moment().format('YYYY-MM-DD HH:mm:ss');
		console.log('time:', socket.room, socket.name, t);
		io.to(socket.room).emit('time', {name:socket.name, time:t});
	});
});

redis.psubscribe((process.env.REDIS_QUEUE || 'chat:') + '*', function(err, count) {
});
redis.on('pmessage', function(subscrbed, channel, message) {
	message = JSON.parse(message);
	console.log(channel + ':' + message.room, message.data);
	io.to(message.room).emit('chat', message.data);
});
