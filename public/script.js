class Message {
    constructor(user, text, time, type = 'text', fileData = null) {
        this.user = user;
        this.text = text;
        this.time = time;
        this.type = type;
        this.fileData = fileData;
        this.id = `${time}-${Math.random().toString(36).substr(2, 9)}`;
    }
}

class ChatClient {
    constructor() {
        this.socket = io();
        this.messagesDiv = document.getElementById('messages');
        this.messageInput = document.getElementById('messageInput');
        this.fileInput = document.getElementById('fileInput');
        this.usersCountDiv = document.getElementById('usersCount');
        this.roomName = 'default';
        this.processedFiles = new Set();
        this.username = this.generateDefaultUsername();
        this.initSocketEvents();
        this.setupRoomSelect();
        this.setupChangeNameButton();
    }

    generateDefaultUsername() {
        return 'User' + Math.floor(Math.random() * 1000);
    }

    setupChangeNameButton() {
        document.getElementById('changeNameButton').addEventListener('click', () => {
            const newName = prompt('Introdu noul nume:', this.username);
            if (newName && newName.trim()) {
                this.username = newName.trim();
                // Anunță serverul despre schimbarea numelui
                this.socket.emit('updateUsername', {
                    oldName: this.username,
                    newName: newName,
                    room: this.roomName
                });
            }
        });
    }

    initSocketEvents() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.socket.emit('joinRoom', this.roomName);
        });

        this.socket.on('updateUserCount', (count) => {
            this.usersCountDiv.textContent = `Utilizatori online: ${count}`;
        });

        this.socket.on('messageHistory', (history) => {
            console.log('Received message history:', history);
            this.messagesDiv.innerHTML = '';
            this.processedFiles.clear();
            history.forEach(msg => {
                if (msg.type === 'file') {
                    this.displayFile(msg);
                } else {
                    this.displayMessage(msg);
                }
            });
        });

        this.socket.on('receiveMessage', (message) => {
            console.log('Received message:', message);
            this.displayMessage(message);
        });

        this.socket.on('receiveFile', (fileMessage) => {
            console.log('Received file message:', fileMessage);
            if (!this.isFileProcessed(fileMessage)) {
                this.displayFile(fileMessage);
                this.markFileAsProcessed(fileMessage);
            }
        });
    }

    setupRoomSelect() {
        const roomSelect = document.getElementById('roomSelect');
        roomSelect.addEventListener('change', (e) => {
            this.roomName = e.target.value;
            this.socket.emit('joinRoom', this.roomName);
            this.messagesDiv.innerHTML = '';
            this.processedFiles.clear();
        });
    }


    isFileProcessed(fileMessage) {
        const fileId = this.getFileId(fileMessage);
        return this.processedFiles.has(fileId);
    }

    markFileAsProcessed(fileMessage) {
        const fileId = this.getFileId(fileMessage);
        this.processedFiles.add(fileId);
    }

    getFileId(fileMessage) {
        return `${fileMessage.time}-${fileMessage.fileData.name}-${fileMessage.fileData.size}`;
    }

    setupRoomSelect() {
        const roomSelect = document.getElementById('roomSelect');
        roomSelect.addEventListener('change', (e) => {
            this.roomName = e.target.value;
            this.socket.emit('joinRoom', this.roomName);
            this.messagesDiv.innerHTML = '';
            this.processedFiles.clear();
            this.socket.emit('getMessageHistory', this.roomName);
        });
    }

    sendMessage() {
        const text = this.messageInput.value.trim();
        if (text) {
            const message = new Message(this.username, text, new Date().toLocaleTimeString(), 'text');
            this.socket.emit('sendMessage', { room: this.roomName, ...message });
            this.messageInput.value = '';
        }
    }

    sendFile() {
        const file = this.fileInput.files[0];
        if (file) {
            if (this.isSending) {
                console.log('File upload in progress, please wait...');
                return;
            }

            this.isSending = true;
            console.log('Processing file:', file.name);
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const fileData = {
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    url: e.target.result,
                    time: new Date().toLocaleTimeString()
                };

                const fileMessage = new Message(
                    this.username,
                    `Sent file: ${file.name}`,
                    fileData.time,
                    'file',
                    fileData
                );

                this.socket.emit('sendFile', { room: this.roomName, ...fileMessage });
                this.fileInput.value = '';
                this.isSending = false;
            };

            reader.onerror = (error) => {
                console.error('Error reading file:', error);
                this.isSending = false;
            };

            reader.readAsDataURL(file);
        }
    }

    displayMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
    
        messageElement.setAttribute('data-message-id', message.id);
        messageElement.innerHTML = `<strong>${message.user}</strong> [${message.time}]: ${message.text}`;
        this.messagesDiv.appendChild(messageElement);
        this.scrollToBottom();
    }

    displayFile(message) {
        if (this.isFileProcessed(message)) {
            return;
        }

        console.log('Displaying file message:', message);
        const fileElement = document.createElement('div');
        fileElement.classList.add('file-message');
        if (message.user === this.username) {
            fileElement.classList.add('own-message');
        }
        fileElement.setAttribute('data-file-id', this.getFileId(message));
        
        const fileData = message.fileData;
        const fileLink = document.createElement('a');
        fileLink.href = fileData.url;
        fileLink.download = fileData.name;
        fileLink.textContent = fileData.name;
        
        const fileInfo = document.createElement('span');
        fileInfo.textContent = ` (${this.formatFileSize(fileData.size)}) - ${message.time}`;
        
        fileElement.innerHTML = `<strong>${message.user}</strong> `;
        fileElement.appendChild(fileLink);
        fileElement.appendChild(fileInfo);
        
        this.messagesDiv.appendChild(fileElement);
        this.scrollToBottom();
    }

    scrollToBottom() {
        this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight;
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
}

// Inițializare
const client = new ChatClient();

document.getElementById('sendButton').addEventListener('click', () => client.sendMessage());
document.getElementById('fileButton').addEventListener('click', () => client.sendFile());
document.getElementById('messageInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        client.sendMessage();
    }
});