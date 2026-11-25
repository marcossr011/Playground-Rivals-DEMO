import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { ReportSheet } from '../components/ReportSheet';
import { useApp } from '../state/AppContext';
import { useMutes } from '../lib/chat';
import { filterProfanity } from '../lib/profanity';
import { friendCodeFor } from '../lib/randomSession';
import { connectOnline, socket } from '../net/socket';
import type { DirectMessage } from '../shared/social';

export default function PrivateChat() {
  const { code = '' } = useParams();
  const friendCode = code.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 8);
  const { state, appendMessage, clearChat } = useApp();
  const friend = state.friends.find((item) => item.code === friendCode);
  const myCode = friendCodeFor(state.profile.id);
  const thread = state.chats[friendCode] ?? [];
  const [text, setText] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const end = useRef<HTMLDivElement | null>(null);
  const { muted, toggle } = useMutes(`dm-${friendCode}`);

  const messages = useMemo(
    () =>
      [...thread].sort((a, b) => a.at - b.at).map((message) => ({
        ...message,
        text: filterProfanity(message.text, state.filter)
      })),
    [thread, state.filter]
  );

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);

  useEffect(() => {
    if (!friend) return;
    const active = connectOnline();
    let disposed = false;
    let registered = false;

    const register = () => {
      active.emit('friend:register', { code: myCode, name: state.profile.name, avatar: state.profile.avatar }, (response) => {
        if (disposed || !response.ok) return;
        registered = true;
        active.emit('dm:history', { withCode: friendCode }, (history) => {
          if (disposed || !history.ok || !history.messages) return;
          for (const message of history.messages) {
            appendMessage(friendCode, {
              id: message.id,
              from: message.from === myCode ? 'me' : 'them',
              text: message.text,
              at: message.at
            });
          }
        });
      });
    };

    const onMessage = ({ message }: { threadWith: string; message: DirectMessage }) => {
      const from = message.from.toUpperCase();
      if (from === myCode) {
        appendMessage(friendCode, { id: message.id, from: 'me', text: message.text, at: message.at });
        return;
      }
      if (from !== friendCode) return;
      appendMessage(friendCode, { id: message.id, from: 'them', text: message.text, at: message.at });
    };

    active.on('dm:message', onMessage);
    active.on('connect', register);
    if (active.connected) register();
    else if (registered) register();

    return () => {
      disposed = true;
      active.off('dm:message', onMessage);
      active.off('connect', register);
    };
  }, [friend, friendCode, myCode, appendMessage, state.profile.name, state.profile.avatar]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const send = (event: React.FormEvent) => {
    event.preventDefault();
    const raw = text.trim();
    if (!raw || !friend) return;
    const filtered = filterProfanity(raw, state.filter);
    setText('');
    socket.emit('dm:send', { to: friendCode, text: filtered }, (response) => {
      if (!response.ok) {
        setText(raw);
        setNotice(response.error ?? 'Tu amigo no está conectado ahora mismo.');
      }
    });
  };

  if (!friend) {
    return (
      <div className="screen dm-screen">
        <header className="play-topbar">
          <Link to="/perfil" className="icon-btn" aria-label="Volver">
            <Icon name="arrow-left" size={20} />
          </Link>
          <div className="play-heading">
            <span className="play-emoji" aria-hidden="true">
              🔒
            </span>
            <div>
              <h1>Chat privado</h1>
              <p>Solo amigos</p>
            </div>
          </div>
        </header>
        <div className="dm-lock">
          <span className="big">🔐</span>
          <h2>Este chat es solo para amigos</h2>
          <p>Añade a esta persona con su código desde tu perfil y podréis hablar en privado. No se puede escribir a desconocidos.</p>
          <Link to="/perfil" className="btn btn-primary">
            Gestionar amigos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="screen dm-screen">
      <header className="dm-head">
        <Link to="/perfil" className="icon-btn" aria-label="Volver">
          <Icon name="arrow-left" size={20} />
        </Link>
        <span className="dm-avatar" aria-hidden="true">
          {friend.avatar}
        </span>
        <div className="grow">
          <h1>{friend.name}</h1>
          <small>
            {friend.code} · privado entre amigos
          </small>
        </div>
        <button
          type="button"
          className={`icon-btn small ${muted.has(friend.code) ? 'active' : ''}`}
          onClick={() => toggle(friend.code)}
          aria-label={muted.has(friend.code) ? 'Mostrar mensajes' : 'Silenciar a este amigo'}
          aria-pressed={muted.has(friend.code)}
        >
          {muted.has(friend.code) ? '🔇' : '🔊'}
        </button>
        <button type="button" className="icon-btn small" onClick={() => setReportOpen(true)} aria-label="Reportar a este amigo">
          <Icon name="flag" size={17} />
        </button>
      </header>

      {notice ? (
        <div className="room-notice" role="status">
          {notice}
        </div>
      ) : null}

      <div className="room-privacy">
        <Icon name="shield" size={16} />
        <span>
          Mensajes privados con filtro {state.filter === 'off' ? 'desactivado' : state.filter === 'strict' ? 'estricto' : 'suave'}.
          Silencia o reporta si algo va mal. Solo se entregan si tu amigo tiene Recreo abierto.
        </span>
      </div>

      <div className="dm-thread">
        {messages.length ? (
          messages.map((message) => (
            <div
              key={message.id}
              className={`chat-bubble ${message.from === 'me' ? 'is-mine' : 'is-them'}`}
            >
              <span className="chat-author">{message.from === 'me' ? 'Tú' : friend.name}</span>
              <p>{muted.has(friend.code) && message.from !== 'me' ? 'Mensaje oculto porque silenciaste a este amigo.' : message.text}</p>
            </div>
          ))
        ) : (
          <p className="tinytip">Aún no hay mensajes con {friend.name}. Escribe el primero.</p>
        )}
        <div ref={end} />
      </div>

      <form className="chat-form" onSubmit={send}>
        <input
          className="input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Mensaje privado…"
          maxLength={160}
          aria-label="Mensaje privado"
        />
        <button type="submit" className="icon-btn" disabled={!text.trim()} aria-label="Enviar mensaje">
          <Icon name="send" size={18} />
        </button>
      </form>

      <div className="game-actions" style={{ marginTop: 8 }}>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            if (window.confirm('¿Borrar esta conversación de este móvil?')) {
              clearChat(friendCode);
            }
          }}
        >
          Borrar conversación
        </button>
        <Link to="/perfil" className="btn btn-ghost btn-sm">
          Gestionar amigos
        </Link>
      </div>

      <ReportSheet
        open={reportOpen}
        targetName={friend.name}
        onClose={() => setReportOpen(false)}
        onSubmit={(reason) => {
          socket.emit(
            'report:send',
            { context: 'dm', code: myCode, targetId: friend.code, targetName: friend.name, reason },
            (response) => setNotice(response.ok ? 'Reporte enviado. Gracias.' : response.error ?? 'No se pudo enviar.')
          );
        }}
      />
    </div>
  );
}
