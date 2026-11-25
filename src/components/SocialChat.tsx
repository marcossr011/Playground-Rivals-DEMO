import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { AvatarVisual } from './AvatarVisual';
import { ReportSheet } from './ReportSheet';
import { useMutes } from '../lib/chat';
import { filterProfanity } from '../lib/profanity';
import type { ProfanityLevel } from '../types';

export interface ChatPerson {
  id: string;
  name: string;
  avatar?: string;
}

export interface ChatItem {
  id: string;
  playerId: string;
  name: string;
  text: string;
  at: number;
  system?: boolean;
}

interface SocialChatProps {
  title?: string;
  subtitle?: string;
  messages: ChatItem[];
  meId: string;
  people: ChatPerson[];
  muteScope: string;
  filter: ProfanityLevel;
  onSend: (text: string) => void;
  onReport: (target: ChatPerson, reason: string) => void;
  emptyText?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function SocialChat({
  title = 'Chat',
  subtitle = 'Mensajes para la sala',
  messages,
  meId,
  people,
  muteScope,
  filter,
  onSend,
  onReport,
  emptyText = 'Todavía no hay mensajes. Rompe el hielo.',
  placeholder = 'Escribe un mensaje…',
  disabled = false
}: SocialChatProps) {
  const [text, setText] = useState('');
  const [report, setReport] = useState<ChatPerson | null>(null);
  const end = useRef<HTMLDivElement | null>(null);
  const { muted, toggle } = useMutes(muteScope);
  const others = people.filter((person) => person.id !== meId);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || disabled) return;
    onSend(value);
    setText('');
  };

  return (
    <section className="room-chat social-chat">
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <span className={`badge ${filter === 'off' ? '' : 'live'}`}>
          {filter === 'off' ? 'Sin filtro' : filter === 'strict' ? 'Filtro estricto' : 'Filtro suave'}
        </span>
      </div>

      {others.length ? (
        <div className="chat-tools" aria-label="Silenciar jugadores">
          {others.map((person) => (
            <span key={person.id} className="chat-person">
              <AvatarVisual className="avatar-inline" value={person.avatar} />
              {person.name}
              <button
                type="button"
                className={muted.has(person.id) ? 'is-on' : ''}
                onClick={() => toggle(person.id)}
                aria-label={muted.has(person.id) ? `Dejar de silenciar a ${person.name}` : `Silenciar a ${person.name}`}
                aria-pressed={muted.has(person.id)}
              >
                {muted.has(person.id) ? '🔇' : '🔊'}
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="chat-list">
        {messages.length ? (
          messages.map((message) => {
            if (message.system) {
              return (
                <p key={message.id} className="chat-muted-note">
                  {message.text}
                </p>
              );
            }
            const mine = message.playerId === meId;
            const hidden = muted.has(message.playerId);
            return (
              <div key={message.id} className={`chat-bubble ${mine ? 'is-mine' : 'is-other'}`}>
                {!mine ? (
                  <span className="chat-author">
                    {message.name}
                    <span className="chat-report">
                      <button
                        type="button"
                        onClick={() => toggle(message.playerId)}
                        aria-label={`${hidden ? 'Mostrar' : 'Silenciar'} mensajes de ${message.name}`}
                      >
                        {hidden ? '🔇' : '🔊'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setReport({ id: message.playerId, name: message.name })}
                        aria-label={`Reportar a ${message.name}`}
                      >
                        🚩
                      </button>
                    </span>
                  </span>
                ) : null}
                <p>{hidden ? 'Mensaje oculto porque silenciaste a este jugador.' : filterProfanity(message.text, filter)}</p>
              </div>
            );
          })
        ) : (
          <p className="tinytip">{emptyText}</p>
        )}
        <div ref={end} />
      </div>

      <form className="chat-form" onSubmit={submit}>
        <input
          className="input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={placeholder}
          maxLength={180}
          aria-label="Mensaje de chat"
          disabled={disabled}
        />
        <button type="submit" className="icon-btn" disabled={disabled || !text.trim()} aria-label="Enviar mensaje">
          <Icon name="send" size={18} />
        </button>
      </form>

      <ReportSheet
        open={Boolean(report)}
        targetName={report?.name ?? ''}
        onClose={() => setReport(null)}
        onSubmit={(reason) => {
          if (report) onReport(report, reason);
        }}
      />
    </section>
  );
}
