import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { LogIn, UserPlus, Send, MessageSquare, LogOut } from 'lucide-react';

const BACKEND_URL = 'http://localhost:5000';

export default function App() {
  // Auth State
  const [token, setToken] = useState(localStorage.getItem('chat_token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('chat_user')) || null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');

  // Chat State
  const [socket, setSocket] = useState(null);
  const [rooms] = useState(['General', 'Tech Talk', 'Random', 'Gaming']);
  const [currentRoom, setCurrentRoom] = useState('General');
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [typingUser, setTypingUser] = useState('');

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // 1. Manage Socket.io Lifecycle Connection
  useEffect(() => {
    if (!token) {
      if (socket) socket.disconnect();
      return;
    }

    // Initialize authenticated socket connection
    const newSocket = io(BACKEND_URL, {
      auth: { token }
    });

    setSocket(newSocket);

    // Socket Event Listeners
    newSocket.on('message_history', (history) => {
      setMessages(history);
    });

    newSocket.on('receive_message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    newSocket.on('user_typing', (data) => {
      if (data.isTyping) {
        setTypingUser(data.username);
      } else {
        setTypingUser('');
      }
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      handleLogout();
    });

    return () => newSocket.disconnect();
  }, [token]);

  // 2. Handle Auto-Joining Rooms when Selection Changes
  useEffect(() => {
    if (socket) {
      setMessages([]); // Clear chat layout during changeover
      socket.emit('join_room', currentRoom);
    }
  }, [currentRoom, socket]);

  // 3. Auto Scroll View Window to the Latest Message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 4. HTTP Auth Request Handlers
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';

    try {
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || 'Authentication failed');

      localStorage.setItem('chat_token', data.token);
      localStorage.setItem('chat_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_user');
    setToken('');
    setUser(null);
    if (socket) socket.disconnect();
  };

  // 5. Chat Communication Handlers
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !socket) return;

    socket.emit('send_message', {
      room: currentRoom,
      content: inputMessage
    });

    setInputMessage('');
    // Instantly notify server that the user has stopped typing upon hitting send
    socket.emit('typing', { room: currentRoom, isTyping: false });
  };

  const handleInputChange = (e) => {
    setInputMessage(e.target.value);
    if (!socket) return;

    // Send typing event status
    socket.emit('typing', { room: currentRoom, isTyping: true });

    // Debounce: Clear previous timer and trigger a reset after 1.5 seconds of silence
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', { room: currentRoom, isTyping: false });
    }, 1500);
  };

  // --- RENDERING INTERFACE LAYOUTS ---

  // Auth Screen Template
  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 text-white">
        <div className="w-full max-w-md rounded-2xl bg-slate-800 p-8 shadow-xl border border-slate-700">
          <div className="mb-6 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-teal-400">Splash Chat</h2>
            <p className="mt-2 text-sm text-slate-400">
              {isRegistering ? 'Create your full-stack tech profile' : 'Sign in to access secure real-time messaging'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                placeholder="chizzy"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                placeholder="••••••••"
              />
            </div>

            {authError && <div className="text-sm text-red-400 font-medium">{authError}</div>}

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-500 hover:bg-teal-600 px-4 py-2 font-semibold text-slate-900 transition-colors"
            >
              {isRegistering ? <UserPlus size={18} /> : <LogIn size={18} />}
              {isRegistering ? 'Register Account' : 'Log In'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm">
            <button
              onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }}
              className="text-teal-400 hover:underline"
            >
              {isRegistering ? 'Already have an account? Sign In' : "Don't have an account? Register"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Live Chat Panel Interface Template
  return (
    <div className="flex h-screen bg-slate-900 text-white overflow-hidden">
      {/* Sidebar: Channel List */}
      <div className="w-64 bg-slate-800 flex flex-col border-r border-slate-700 hidden sm:flex">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
          <div>
            <h1 className="font-bold text-teal-400 text-lg">Channels</h1>
            <p className="text-xs text-slate-400">Logged in as: <span className="font-medium text-slate-300">{user?.username}</span></p>
          </div>
          <button onClick={handleLogout} className="text-slate-400 hover:text-red-400 transition-colors" title="Log Out">
            <LogOut size={18} />
          </button>
        </div>
        <div className="flex-1 p-2 space-y-1 overflow-y-auto">
          {rooms.map((room) => (
            <button
              key={room}
              onClick={() => setCurrentRoom(room)}
              className={`flex w-full items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                currentRoom === room 
                  ? 'bg-teal-500 text-slate-900 font-semibold shadow-md' 
                  : 'text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              <MessageSquare size={16} />
              {room}
            </button>
          ))}
        </div>
      </div>

      {/* Primary Conversation Screen Panel */}
      <div className="flex-1 flex flex-col bg-slate-900">
        {/* Active Room Top Bar Header */}
        <div className="h-16 border-b border-slate-700 flex items-center justify-between px-6 bg-slate-800/30">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-slate-100"># {currentRoom}</span>
            <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block animate-pulse" title="System Live"></span>
          </div>
          <button onClick={handleLogout} className="sm:hidden text-slate-400 hover:text-red-400 transition-colors">
            <LogOut size={20} />
          </button>
        </div>

        {/* Message Feeds Layout Viewport */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, index) => {
            const isMe = msg.senderName === user?.username;
            return (
              <div key={msg._id || index} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-slate-400">{msg.senderName}</span>
                  <span className="text-[10px] text-slate-500">
                    {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                  </span>
                </div>
                <div className={`max-w-md px-4 py-2.5 rounded-2xl text-sm break-words shadow-sm ${
                  isMe ? 'bg-teal-500 text-slate-900 font-medium rounded-tr-none' : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700'
                }`}>
                  {msg.content}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Live System Updates Footer Overlay (Typing Indicators) */}
        <div className="px-6 h-6 text-xs text-teal-400 italic font-medium">
          {typingUser && `${typingUser} is typing a message...`}
        </div>

        {/* Message Input Submission Bar */}
        <form onSubmit={handleSendMessage} className="p-4 bg-slate-800/40 border-t border-slate-700 flex gap-3">
          <input
            type="text"
            value={inputMessage}
            onChange={handleInputChange}
            className="flex-1 rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
            placeholder={`Message # ${currentRoom}...`}
          />
          <button
            type="submit"
            className="bg-teal-500 hover:bg-teal-600 text-slate-900 font-bold p-3 rounded-xl transition-colors shadow-md flex items-center justify-center"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}