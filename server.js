const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

class Message {
    constructor(user, text, time, type = 'text', fileData = null) {
        this.user = user;
        this.text = text;
        this.time = time;
        this.type = type;
        this.fileData = fileData;
    }
}

class ChatServer {
    constructor(port) {
        this.port = port;
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            maxHttpBufferSize: 10 * 1024 * 1024, // 10 MB
        });
        this.chatRooms = {};
        this.roomUsers = {}; // Stochează numărul de utilizatori per cameră

        this.configureRoutes();
        this.handleConnections();
    }

    configureRoutes() {
        this.app.use(express.static(path.join(__dirname, 'public')));
    }

    handleConnections() {
        this.io.on('connection', (socket) => {
            console.log(`User connected: ${socket.id}`);
            
            socket.on('joinRoom', (roomName) => {
                // Părăsește camera anterioară dacă există
                if (socket.currentRoom) {
                    socket.leave(socket.currentRoom);
                    this.roomUsers[socket.currentRoom]--;
                    this.io.to(socket.currentRoom).emit('updateUserCount', this.roomUsers[socket.currentRoom]);
                }

                // Intră în noua cameră
                socket.join(roomName);
                socket.currentRoom = roomName;
                
                // Inițializează camera și contorul dacă nu există
                if (!this.chatRooms[roomName]) {
                    this.chatRooms[roomName] = [];
                }
                if (!this.roomUsers[roomName]) {
                    this.roomUsers[roomName] = 0;
                }
                
                // Incrementează contorul și trimite update
                this.roomUsers[roomName]++;
                this.io.to(roomName).emit('updateUserCount', this.roomUsers[roomName]);
                
                console.log(`${socket.id} joined room: ${roomName}. Users in room: ${this.roomUsers[roomName]}`);
                socket.emit('messageHistory', this.chatRooms[roomName]);
            });

            socket.on('sendMessage', (data) => {
                console.log('Received message:', data);
                const message = new Message(data.user, data.text, data.time);
                this.chatRooms[data.room].push(message);
                this.io.to(data.room).emit('receiveMessage', message);
            });

            socket.on('sendFile', (fileMessage) => {
                console.log('Received file:', fileMessage.fileData.name);
                this.chatRooms[fileMessage.room].push(fileMessage);
                this.io.to(fileMessage.room).emit('receiveFile', fileMessage);
            });

            socket.on('disconnect', () => {
                console.log(`User disconnected: ${socket.id}`);
                if (socket.currentRoom) {
                    this.roomUsers[socket.currentRoom]--;
                    this.io.to(socket.currentRoom).emit('updateUserCount', this.roomUsers[socket.currentRoom]);
                    console.log(`Users remaining in room ${socket.currentRoom}: ${this.roomUsers[socket.currentRoom]}`);
                }
            });
        });
    }

    start() {
        this.server.listen(this.port, () => {
            console.log(`Server running on http://localhost:${this.port}`);
        });
    }
}
const chatServer = new ChatServer(3000);
chatServer.start();