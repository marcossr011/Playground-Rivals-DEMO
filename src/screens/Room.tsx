import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { AvatarVisual } from '../components/AvatarVisual';
import { SocialChat } from '../components/SocialChat';
import { useApp } from '../state/AppContext';
import { dropRow } from '../shared/connect4';
import { legalMoves } from '../shared/reversi';
import type { RoomSnapshot } from '../shared/online';
import { connectOnline, forgetSeat, recallSeat, rememberSeat, socket } from '../net/socket';
import { clearRandomSession, readRandomSession } from '../lib/randomSession';

const leaveTimers = new Map<string, number>();

function useNow(active: boolean, deadline: number | undefined) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [active, deadline]);
  return now;
}

function secondsLeft(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export default function Room() {
  const { code = '' } = useParams();
  const roomCode = code.toUpperCase();
  const navigate = useNavigate();
  const { state, recordLeagueResult } = useApp();
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(() => recallSeat(roomCode));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [rematchAsked, setRematchAsked] = useState(false);
  const noticeTimer = useRef<number | null>(null);

  const flash = (message: string) => {
    setNotice(message);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 2600);
  };

  useEffect(() => {
    if (!roomCode) return;
    const active = connectOnline();
    let disposed = false;
    const pending = leaveTimers.get(roomCode);
    if (pending) {
      window.clearTimeout(pending);
      leaveTimers.delete(roomCode);
    }

    const rejoin = () => {
      const seat = recallSeat(roomCode);
      if (!seat) {
        setError('Esta sala no está guardada en este dispositivo. Vuelve a entrar con el código.');
        return;
      }
      active.emit('room:rejoin', { code: roomCode, playerId: seat }, (response) => {
        if (disposed) return;
        if (!response.ok) {
          setError(response.error ?? 'No se pudo entrar en la sala.');
          return;
        }
        if (response.playerId) {
          rememberSeat(roomCode, response.playerId);
          setPlayerId(response.playerId);
        }
        if (response.snapshot) setSnapshot(response.snapshot);
        setError(null);
      });
    };

    const onUpdate = (next: RoomSnapshot) => {
      setSnapshot(next);
      setError(null);
    };
    const onClosed = ({ reason }: { reason: string }) => {
      setSnapshot(null);
      setError(reason);
    };
    const onToast = ({ message }: { message: string }) => flash(message);

    active.on('room:update', onUpdate);
    active.on('room:closed', onClosed);
    active.on('toast', onToast);
    active.on('connect', rejoin);
    if (active.connected) rejoin();

    return () => {
      disposed = true;
      active.off('room:update', onUpdate);
      active.off('room:closed', onClosed);
      active.off('toast', onToast);
      active.off('connect', rejoin);
      const timer = window.setTimeout(() => {
        socket.emit('room:leave', { code: roomCode });
        leaveTimers.delete(roomCode);
      }, 900);
      leaveTimers.set(roomCode, timer);
    };
  }, [roomCode]);

  const room = snapshot?.room;
  const game = snapshot?.game;
  const me = room?.players.find((player) => player.id === playerId);
  const rival = room?.players.find((player) => player.id !== playerId);
  const playing = room?.status === 'playing';
  const now = useNow(Boolean(playing && game), game?.deadline);

  useEffect(() => {
    if (room?.status !== 'ended') setRematchAsked(false);
  }, [room?.status]);

  useEffect(() => {
    if (room?.status !== 'ended' || !room.result) return;
    const random = readRandomSession();
    if (!random || random.mode !== 'people' || random.format !== '1v1') return;
    const seat = room.players.find((player) => player.id === playerId)?.seat;
    if (seat === undefined) return;
    recordLeagueResult(room.result.winner === seat);
    clearRandomSession();
  }, [room?.status, room?.result, room?.players, playerId, recordLeagueResult]);

  const leave = () => {
    socket.emit('room:leave', { code: roomCode });
    forgetSeat(roomCode);
    navigate('/salas');
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      flash('Código copiado.');
    } catch {
      flash(`Código: ${roomCode}`);
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/sala/${roomCode}`;
    const text = `Únete a mi partida de ${room?.gameTitle ?? 'Recreo'} en Recreo. Código ${roomCode}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Recreo', text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}: ${url}`);
      flash('Invitación copiada.');
    } catch {
      /* compartir cancelado */
    }
  };

  const move = (payload: unknown) => {
    if (sending || !playing) return;
    setSending(true);
    socket.emit('game:move', { code: roomCode, move: payload }, (response) => {
      setSending(false);
      if (!response.ok) flash(response.error ?? 'Movimiento rechazado.');
    });
    window.setTimeout(() => setSending(false), 5000);
  };

  const rematch = () => {
    socket.emit('room:rematch', { code: roomCode }, (response) => {
      if (!response.ok) flash(response.error ?? 'No se pudo pedir revancha.');
      else setRematchAsked(true);
    });
  };

  const reportUser = (target: { id: string; name: string }, reason: string) => {
    socket.emit(
      'report:send',
      { context: 'room', code: roomCode, targetId: target.id, targetName: target.name, reason },
      (response) => {
        if (!response.ok) flash(response.error ?? 'No se pudo enviar el reporte.');
        else flash('Reporte enviado.');
      }
    );
  };

  const timer = game ? secondsLeft(game.deadline, now) : 0;
  const urgent = playing && timer <= 10;

  if (error) {
    return (
      <div className="screen room-screen">
        <div className="room-error">
          <span aria-hidden="true">📡</span>
          <h1>No se pudo entrar</h1>
          <p className="muted">{error}</p>
          <Link to="/salas" className="btn btn-primary">
            Volver a las salas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="screen room-screen">
      <header className="play-topbar">
        <button type="button" className="icon-btn" onClick={leave} aria-label="Salir de la sala">
          <Icon name="arrow-left" size={20} />
        </button>
        <div className="play-heading">
          <span className="play-emoji" aria-hidden="true">
            {room?.gameEmoji ?? '🎮'}
          </span>
          <div>
            <h1>{room?.gameTitle ?? 'Sala online'}</h1>
            <p>Código {room?.code ?? roomCode}</p>
          </div>
        </div>
        <button type="button" className="icon-btn small" onClick={share} aria-label="Compartir invitación">
          <Icon name="share" size={18} />
        </button>
      </header>

      {notice ? (
        <div className="room-notice" role="status">
          {notice}
        </div>
      ) : null}

      {!snapshot || !room ? (
        <div className="room-loading">
          <span className="spin" />
          <p className="muted">Conectando con la sala {roomCode}…</p>
        </div>
      ) : (
        <>
          <section className="room-code-card">
            <div>
              <span className="faint">Código de sala</span>
              <strong className="room-code">{room.code.split('').join(' ')}</strong>
            </div>
            <div className="room-code-actions">
              <button type="button" className="icon-btn small" onClick={copyCode} aria-label="Copiar código">
                <Icon name="copy" size={17} />
              </button>
              <span className={`badge ${playing ? 'live' : room.status === 'ended' ? '' : 'hot'}`}>
                {room.status === 'waiting' ? 'Esperando' : room.status === 'playing' ? 'En juego' : 'Terminada'}
              </span>
            </div>
          </section>

          <div className="room-seats">
            {[0, 1].map((seat) => {
              const player = room.players.find((item) => item.seat === seat);
              return (
                <div key={seat} className={`room-seat ${player?.id === playerId ? 'is-me' : ''}`}>
                  <AvatarVisual className="room-seat-avatar" value={player?.avatar} fallback="⏳" />
                  <div className="grow">
                    <strong>{player ? player.name : 'Esperando…'}</strong>
                    <small className="faint">
                      {player ? (player.connected ? (player.id === playerId ? 'Tú' : 'Rival') : 'Desconectado') : 'Comparte el código'}
                    </small>
                  </div>
                  {playing && game && game.kind !== 'trivia' && game.state.turn === seat ? (
                    <span className="room-turn-dot" aria-label="En su turno" />
                  ) : null}
                </div>
              );
            })}
          </div>

          {room.status === 'waiting' ? (
            <section className="room-waiting">
              <div className="room-waiting-art" aria-hidden="true">
                <span>{room.gameEmoji}</span>
                <i />
                <i />
              </div>
              <h2>Falta tu rival</h2>
              <p className="muted">Comparte el código o el enlace. La partida arranca en cuanto entre.</p>
              <div className="game-actions">
                <button type="button" className="btn btn-primary" onClick={share}>
                  <Icon name="share" size={17} /> Compartir invitación
                </button>
                <button type="button" className="btn btn-ghost" onClick={copyCode}>
                  <Icon name="copy" size={17} /> Copiar código
                </button>
              </div>
            </section>
          ) : null}

          {game && playing ? (
            <section className="room-stage">
              <div className="room-stage-head">
                <div className="room-stage-turn">
                  {game.kind === 'trivia'
                    ? `Pregunta ${game.index + 1} de ${game.total}`
                    : game.state.turn === me?.seat
                      ? 'Tu turno'
                      : `Turno de ${rival?.name ?? 'tu rival'}`}
                </div>
                <span className={`hud-chip ${urgent ? 'is-danger' : ''}`}>
                  <Icon name="timer" size={14} /> {timer}s
                </span>
              </div>

              {game.kind === 'ttt' ? (
                <div className={`ttt-board online ${game.state.turn === me?.seat ? 'is-live' : ''}`}>
                  {game.state.board.map((cell, index) => (
                    <button
                      key={index}
                      type="button"
                      className={`ttt-cell mark-${cell} ${game.state.line.includes(index) ? 'is-win' : ''}`}
                      disabled={!playing || game.state.turn !== me?.seat || cell !== 0}
                      onClick={() => move({ index })}
                      aria-label={`Casilla ${index + 1}${cell ? `, jugador ${cell}` : ''}`}
                    />
                  ))}
                </div>
              ) : null}

              {game.kind === 'c4' ? (
                <div className="c4-wrap online">
                  <div className="c4-drops" style={{ gridTemplateColumns: `repeat(${game.state.cols}, 1fr)` }}>
                    {Array.from({ length: game.state.cols }, (_, col) => (
                      <button
                        key={col}
                        type="button"
                        className={`c4-drop ${dropRow(game.state.board, game.state.cols, game.state.rows, col) < 0 ? 'is-blocked' : ''}`}
                        disabled={!playing || game.state.turn !== me?.seat || dropRow(game.state.board, game.state.cols, game.state.rows, col) < 0}
                        onClick={() => move({ col })}
                        aria-label={`Soltar ficha en columna ${col + 1}`}
                      >
                        <Icon name="chevron-right" size={15} />
                      </button>
                    ))}
                  </div>
                  <div
                    className="c4-board"
                    style={{ gridTemplateColumns: `repeat(${game.state.cols}, 1fr)` }}
                    role="grid"
                    aria-label="Tablero de cuatro en línea"
                  >
                    {game.state.board.map((cell, index) => (
                      <div
                        key={index}
                        role="gridcell"
                        className={`c4-cell mark-${cell} ${game.state.line.includes(index) ? 'is-win' : ''} ${game.state.last === index ? 'is-last' : ''}`}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {game.kind === 'reversi' ? (
                <div className="reversi-wrap">
                  <div className="reversi-scores">
                    <span className={me?.seat === 0 ? 'is-me' : ''}>⚫ {game.state.black}</span>
                    <span className={me?.seat === 1 ? 'is-me' : ''}>⚪ {game.state.white}</span>
                  </div>
                  <div
                    className="reversi-board"
                    style={{ gridTemplateColumns: `repeat(${game.state.size}, 1fr)` }}
                  >
                    {game.state.board.map((cell, index) => {
                      const legal =
                        playing &&
                        me !== undefined &&
                        game.state.turn === me.seat &&
                        legalMoves(game.state.board, game.state.size, (me.seat + 1) as 1 | 2).has(index);
                      return (
                        <button
                          key={index}
                          type="button"
                          className={`reversi-cell ${cell ? `mark-${cell}` : ''} ${legal ? 'is-legal' : ''} ${game.state.last === index ? 'is-last' : ''}`}
                          disabled={!legal}
                          onClick={() => move({ index })}
                          aria-label={`Casilla ${index + 1}${legal ? ', jugada posible' : ''}`}
                        >
                          <span className="disc" />
                        </button>
                      );
                    })}
                  </div>
                  {game.state.passed ? <p className="engine-tip is-active-tip">Sin jugadas posibles: turno pasado.</p> : null}
                </div>
              ) : null}

              {game.kind === 'trivia' ? (
                <div className="online-trivia">
                  <div className="trivia-scores">
                    {room.players.map((player) => (
                      <span key={player.id} className={`trivia-score ${player.id === playerId ? 'is-me' : ''}`}>
                        <AvatarVisual className="avatar-inline" value={player.avatar} /> {player.name}
                        <strong>{game.scores[player.seat]}</strong>
                      </span>
                    ))}
                  </div>
                  <div className="quiz-question">
                    {game.visual ? (
                      <div className="quiz-visual" aria-hidden="true">
                        {game.visual}
                      </div>
                    ) : null}
                    <h2>{game.prompt}</h2>
                    <p className="faint">
                      {game.turn === me?.seat ? 'Tu pregunta: elige una opción.' : `Responde ${rival?.name ?? 'tu rival'}…`}
                    </p>
                  </div>
                  <div className="quiz-options">
                    {game.options.map((option, index) => {
                      const correct = game.phase === 'reveal' && game.correct === index;
                      return (
                        <button
                          key={`${option}-${index}`}
                          type="button"
                          className={`quiz-option ${correct ? 'is-correct' : ''}`}
                          disabled={!playing || game.phase !== 'question' || game.turn !== me?.seat}
                          onClick={() => move({ option: index })}
                        >
                          <span>{String.fromCharCode(65 + index)}</span>
                          {option}
                        </button>
                      );
                    })}
                  </div>
                  {game.phase === 'reveal' ? (
                    <p className="engine-tip is-active-tip">
                      {game.correct === null ? 'Se acabó el tiempo.' : `Respuesta correcta: ${game.options[game.correct]}.`}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {room.status === 'ended' ? (
            <section className={`room-result ${room.result?.winner === me?.seat ? 'is-win' : ''}`}>
              <span className="room-result-emoji" aria-hidden="true">
                {room.result?.winner === null ? '🤝' : room.result?.winner === me?.seat ? '🏆' : '🙈'}
              </span>
              <h2>
                {room.result?.winner === null
                  ? 'Empate'
                  : room.result?.winner === me?.seat
                    ? '¡Ganaste!'
                    : `Ganó ${rival?.name ?? 'tu rival'}`}
              </h2>
              <p className="muted">{room.result?.reason}</p>
              <div className="game-actions">
                <button type="button" className="btn btn-primary" onClick={rematch} disabled={rematchAsked}>
                  <Icon name="refresh" size={17} />
                  {rematchAsked ? 'Revancha pedida' : 'Pedir revancha'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={leave}>
                  Salir de la sala
                </button>
              </div>
              {rematchAsked ? <p className="tinytip">Esperando a que tu rival acepte.</p> : null}
            </section>
          ) : null}

          <SocialChat
            title="Chat"
            subtitle="Mensajes para tu rival · silencia o reporta si hace falta"
            messages={room.chat.map((message) => ({
              id: message.id,
              playerId: message.playerId,
              name: message.name,
              text: message.text,
              at: message.at
            }))}
            meId={playerId ?? ''}
            people={room.players.map((player) => ({ id: player.id, name: player.name, avatar: player.avatar }))}
            muteScope={`room-${room.code}`}
            filter={state.filter}
            disabled={room.status === 'ended'}
            onSend={(text) => {
              socket.emit('chat:send', { code: roomCode, text }, (response) => {
                if (!response.ok) flash(response.error ?? 'No se pudo enviar.');
              });
            }}
            onReport={reportUser}
            emptyText="Todavía no hay mensajes. Saluda a tu rival."
          />
        </>
      )}
    </div>
  );
}
