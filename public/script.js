class Message {
    constructor(user, text, time, type = 'text', fileData = null) {
        this.user = user;
        this.text = text;
        this.time = time;
        this.type = type;
        this.fileData = fileData;
    }
}

class ChatClient {
    constructor() {
        this.socket = io();
        this.messagesDiv = document.getElementById('messages');
        this.messageInput = document.getElementById('messageInput');
        this.fileInput = document.getElementById('fileInput');
        this.roomName = 'default';  // Camera de chat implicită
        this.initSocketEvents();
        this.setupRoomSelect();
    }


    initSocketEvents() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.socket.emit('joinRoom', this.roomName);  // Alătură utilizatorul camerei implicite
        });

        this.socket.on('messageHistory', (history) => {
            console.log('Received message history:', history);
            this.messagesDiv.innerHTML = '';
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
            this.displayFile(fileMessage);
        });
    }
    setupRoomSelect() {
        const roomSelect = document.getElementById('roomSelect');
        roomSelect.addEventListener('change', (e) => {
            this.roomName = e.target.value;
            this.socket.emit('joinRoom', this.roomName);
            this.messagesDiv.innerHTML = ''; // Resetează mesajele când schimbi camera
            this.socket.emit('getMessageHistory', this.roomName);
        });
    }


    isDuplicateFile(fileMessage) {
        // Verifică dacă acest fișier există deja în ultimele mesaje
        const messages = this.messagesDiv.getElementsByClassName('file-message');
        for (let msg of messages) {
            const filename = msg.querySelector('a').textContent;
            const timestamp = msg.querySelector('span').textContent;
            if (filename.includes(fileMessage.fileData.name) && 
                timestamp.includes(fileMessage.time)) {
                return true;
            }
        }
        return false;
    }

    sendMessage() {
        const text = this.messageInput.value.trim();
        if (text) {
            const message = new Message('Eu', text, new Date().toLocaleTimeString(), 'text');
            console.log('Sending message:', message);
            this.socket.emit('sendMessage', { room: this.roomName, ...message });
            this.messageInput.value = '';
        }
    }

    displayMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        messageElement.innerHTML = `<strong>${message.user}</strong> [${message.time}]: ${message.text}`;
        this.messagesDiv.appendChild(messageElement);
        this.scrollToBottom();
    }

    sendFile() {
        const file = this.fileInput.files[0];
        if (file) {
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
                    'Eu',
                    `Sent file: ${file.name}`,
                    fileData.time,
                    'file',
                    fileData
                );

                console.log('Sending file message:', fileMessage);
                this.socket.emit('sendFile', { room: this.roomName, ...fileMessage });
                this.fileInput.value = '';
            };
            reader.readAsDataURL(file);
        }
    }

   displayFile(message) {
        console.log('Displaying file message:', message);
        const fileElement = document.createElement('div');
        fileElement.classList.add('file-message');
        
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
        this.messagesDiv.appendChild(document.createElement('br'));
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

const client = new ChatClient();

document.getElementById('sendButton').addEventListener('click', () => client.sendMessage());
document.getElementById('fileButton').addEventListener('click', () => client.sendFile());
document.getElementById('sendButton').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        client.sendMessage();
    }
});