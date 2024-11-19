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
         // Configurarea maxHttpBufferSize pentru a permite fișiere mai mari
         this.io = socketIo(this.server, {
            maxHttpBufferSize: 10 * 1024 * 1024, // 10 MB
        });
        this.messageHistory = [];
        this.configureRoutes();
        this.handleConnections();
        this.chatRooms = {};  // Pentru a stoca camerele de chat și mesajele lor

        
    }

    configureRoutes() {
        this.app.use(express.static(path.join(__dirname, 'public')));
    }

    handleConnections() {
        this.io.on('connection', (socket) => {
            console.log(`User connected: ${socket.id}`);
            
            socket.on('joinRoom', (roomName) => {
                socket.join(roomName); // Adaugă utilizatorul într-o cameră de chat
                console.log(`${socket.id} joined room: ${roomName}`);
                if (!this.chatRooms[roomName]) {
                    this.chatRooms[roomName] = []; // Crează camera dacă nu există
                }
                socket.emit('messageHistory', this.chatRooms[roomName]);
            });

            socket.on('sendMessage', (data) => {
                console.log('Received message:', data);
                const message = new Message(data.user, data.text, data.time);
                this.chatRooms[data.room].push(message);  // Adaugă mesajul în camera corectă
                this.io.to(data.room).emit('receiveMessage', message); // Trimite doar utilizatorilor din cameră
            });

            socket.on('sendFile', (fileMessage) => {
                console.log('Received file:', fileMessage.fileData.name);
                this.chatRooms[fileMessage.room].push(fileMessage); // Salvează fișierul în camera respectivă
                this.io.to(fileMessage.room).emit('receiveFile', fileMessage); // Trimite fișierul doar celor din cameră
            });
            

            socket.on('disconnect', () => {
                console.log(`User disconnected: ${socket.id}`);
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