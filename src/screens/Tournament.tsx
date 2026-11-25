import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { AvatarVisual } from '../components/AvatarVisual';
import { SocialChat } from '../components/SocialChat';
import { useApp } from '../state/AppContext';
import { networkAvatar } from '../lib/avatar';
import { ONLINE_GAMES } from '../data/catalog';
import { dropRow } from '../shared/connect4';
import { legalMoves } from '../shared/reversi';
import type { TournamentMatchPublic, TournamentSnapshot } from '../shared/social';
import { connectOnline, socket } from '../net/socket';
import { clearRandomSession, readRandomSession } from '../lib/randomSession';

const BOARD_GAMES = ONLINE_GAMES.filter((game) => !game.metaId.startsWith('trivia-'));
const leaveTimers = new Map<string, number>();

export default function Tournament() {
  const { gameId = '' } = useParams();
  const navigate = useNavigate();
  const { state, recordLeagueResult } = useApp();
  const [selected, setSelected] = useState(gameId || BOARD_GAMES[0]?.metaId || '');
  const [snapshot, setSnapshot] = useState<TournamentSnapshot | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [queueing, setQueueing] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const codeRef = useRef<string | null>(null);
  const noticeTimer = useRef<number | null>(null);
  const leagueDone = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);

  const flash = (message: string) => {
    setNotice(message);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(''), 2600);
  };

  useEffect(() => {
    const active = connectOnline();
    let disposed = false;
    const onUpdate = (next: TournamentSnapshot) => {
      setSnapshot(next);
      setError('');
    };
    const onClosed = ({ reason }: { reason: string }) => {
      setSnapshot(null);
      codeRef.current = null;
      setError(reason);
    };
    const onToast = ({ message }: { message: string }) => flash(message);
    const onSocialToast = ({ message }: { message: string }) => flash(message);
    active.on('tournament:update', onUpdate);
    active.on('tournament:closed', onClosed);
    active.on('toast', onToast);
    active.on('social:toast', onSocialToast);

    return () => {
      disposed = true;
      active.off('tournament:update', onUpdate);
      active.off('tournament:closed', onClosed);
      active.off('toast', onToast);
      active.off('social:toast', onSocialToast);
      const code = codeRef.current;
      if (disposed && code) {
        const timer = window.setTimeout(() => {
          socket.emit('tournament:leave', { code });
          leaveTimers.delete(code);
        }, 900);
        leaveTimers.set(code, timer);
      }
    };
  }, []);

  useEffect(() => {
    const code = snapshot?.room.code ?? null;
    codeRef.current = code;
    if (code) {
      const pending = leaveTimers.get(code);
      if (pending) {
        window.clearTimeout(pending);
        leaveTimers.delete(code);
      }
    }
  }, [snapshot?.room.code]);

  const join = () => {
    if (!selected) return;
    setQueueing(true);
    setError('');
    socket.emit(
      'tournament:join',
      { gameId: selected, name: state.profile.name, avatar: networkAvatar(state.profile) },
      (response) => {
        setQueueing(false);
        if (!response.ok || !response.snapshot || !response.playerId) {
          setError(response.error ?? 'No se pudo entrar al torneo.');
          return;
        }
        setSnapshot(response.snapshot);
        setPlayerId(response.playerId);
        leagueDone.current = false;
        codeRef.current = response.code ?? response.snapshot.room.code;
      }
    );
    window.setTimeout(() => setQueueing(false), 9000);
  };

  const leave = () => {
    if (snapshot) socket.emit('tournament:leave', { code: snapshot.room.code });
    codeRef.current = null;
    setSnapshot(null);
    setPlayerId(null);
    navigate('/salas');
  };

  const sendMove = (matchId: string, move: unknown) => {
    if (!snapshot) return;
    socket.emit('tournament:move', { code: snapshot.room.code, matchId, move }, (response) => {
      if (!response.ok) flash(response.error ?? 'Movimiento rechazado.');
    });
  };

  const room = snapshot?.room;
  const me = room?.players.find((player) => player.id === playerId);
  const champion = room?.championId ? room.players.find((player) => player.id === room.championId) : null;
  const nameOf = (id: string | null) => (id ? room?.players.find((player) => player.id === id)?.name ?? 'Jugador' : 'Por decidir');
  const avatarOf = (id: string | null) => (id ? room?.players.find((player) => player.id === id)?.avatar ?? '🙂' : '❔');

  const chatPeople = useMemo(
    () => (room?.players ?? []).map((player) => ({ id: player.id, name: player.name, avatar: player.avatar })),
    [room?.players]
  );

  useEffect(() => {
    if (room?.status !== 'ended' || !room.championId || leagueDone.current) return;
    leagueDone.current = true;
    const random = readRandomSession();
    if (random?.mode === 'people' && random.format === 'tournament') {
      recordLeagueResult(room.championId === playerId);
      clearRandomSession();
    }
  }, [room?.status, room?.championId, playerId, recordLeagueResult]);

  const renderBoard = (match: TournamentMatchPublic) => {
    const game = match.game;
    if (!game || game.kind === 'trivia') return <p className="tinytip">Esperando tablero…</p>;
    const slot = match.a === playerId ? 0 : match.b === playerId ? 1 : null;
    const live = game.state.status === 'playing';
    const myTurn = Boolean(live && slot !== null && game.state.turn === slot);
    const seconds = Math.max(0, Math.ceil((game.deadline - now) / 1000));

    if (game.kind === 'ttt') {
      return (
        <div className="tournament-board">
          {game.state.board.map((cell, index) => (
            <button
              key={index}
              type="button"
              className={`mark-${cell} ${game.state.line.includes(index) ? 'is-win' : ''}`}
              disabled={!myTurn || cell !== 0}
              onClick={() => sendMove(match.id, { index })}
              aria-label={`Casilla ${index + 1}`}
            >
              {cell === 1 ? '✕' : cell === 2 ? '◯' : ''}
            </button>
          ))}
        </div>
      );
    }

    if (game.kind === 'c4') {
      return (
        <div style={{ maxWidth: 280, margin: '0 auto' }}>
          <div className="c4-drops" style={{ gridTemplateColumns: `repeat(${game.state.cols}, 1fr)`, marginBottom: 6 }}>
            {Array.from({ length: game.state.cols }, (_, col) => (
              <button
                key={col}
                type="button"
                className="c4-drop"
                disabled={!myTurn || dropRow(game.state.board, game.state.cols, game.state.rows, col) < 0}
                onClick={() => sendMove(match.id, { col })}
                aria-label={`Soltar en columna ${col + 1}`}
              >
                <Icon name="chevron-right" size={12} />
              </button>
            ))}
          </div>
          <div className="tournament-board c4">
            {game.state.board.map((cell, index) => (
              <div
                key={index}
                className={`mark-${cell} ${game.state.line.includes(index) ? 'is-win' : ''}`}
                aria-label={`Ficha ${cell || 'vacía'}`}
              />
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="tournament-board reversi" style={{ maxWidth: 280 }}>
        {game.state.board.map((cell, index) => {
          const legal = Boolean(
            myTurn && slot !== null && legalMoves(game.state.board, game.state.size, (slot + 1) as 1 | 2).has(index)
          );
          return (
            <button
              key={index}
              type="button"
              className={`mark-${cell} ${legal ? 'is-win' : ''}`}
              disabled={!legal}
              onClick={() => sendMove(match.id, { index })}
              aria-label={`Casilla ${index + 1}`}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="screen tournament-screen">
      <header className="play-topbar">
        <button type="button" className="icon-btn" onClick={snapshot ? leave : () => navigate('/salas')} aria-label="Volver">
          <Icon name="arrow-left" size={20} />
        </button>
        <div className="play-heading">
          <span className="play-emoji" aria-hidden="true">
            🏆
          </span>
          <div>
            <h1>Torneo exprés</h1>
            <p>4 jugadores · eliminatorias</p>
          </div>
        </div>
      </header>

      {notice ? (
        <div className="room-notice" role="status">
          {notice}
        </div>
      ) : null}

      {!snapshot || !room ? (
        <>
          <section className="random-hero">
            <span className="random-die" aria-hidden="true">
              🏆
            </span>
            <span className="badge live">Con desconocidos</span>
            <h1>Torneo de 4</h1>
            <p>Semifinales y final. Dos victorias seguidas y el trofeo es tuyo. Si no aparece gente, espera en la cola.</p>
          </section>

          <section className="section">
            <div className="section-head">
              <h2>Elige el juego</h2>
            </div>
            <div className="random-options">
              {BOARD_GAMES.map((game) => (
                <button
                  key={game.metaId}
                  type="button"
                  className={`random-option ${selected === game.metaId ? 'active' : ''}`}
                  onClick={() => setSelected(game.metaId)}
                  aria-pressed={selected === game.metaId}
                >
                  <strong>
                    {game.emoji} {game.name}
                  </strong>
                  <small>{game.blurb}</small>
                </button>
              ))}
            </div>
            {error ? <p className="outdoor-launcher-error" style={{ marginTop: 10 }}>{error}</p> : null}
            <button type="button" className="btn btn-primary btn-wide random-launch" onClick={join} disabled={queueing}>
              <Icon name="trophy" size={17} /> {queueing ? 'Buscando torneo…' : 'Buscar torneo'}
            </button>
            <p className="random-foot">Los cruces se sortean. Tienes 45 segundos por turno.</p>
          </section>
        </>
      ) : (
        <>
          <section className="room-code-card">
            <div>
              <span className="faint">Torneo</span>
              <strong className="room-code" style={{ fontSize: 18 }}>
                {room.gameEmoji} {room.gameTitle}
              </strong>
            </div>
            <div className="room-code-actions">
              <span className={`badge ${room.status === 'playing' ? 'live' : room.status === 'ended' ? '' : 'hot'}`}>
                {room.status === 'waiting' ? 'Buscando gente' : room.status === 'playing' ? 'En juego' : 'Finalizado'}
              </span>
            </div>
          </section>

          {room.status === 'waiting' ? (
            <section className="room-waiting">
              <div className="room-waiting-art" aria-hidden="true">
                <span>🏆</span>
                <i />
                <i />
              </div>
              <h2>Juntando 4 jugadores</h2>
              <p className="muted">Se empieza automáticamente cuando la sala esté llena. Llevas {room.players.length} de 4.</p>
              <div className="outdoor-room-players">
                {[0, 1, 2, 3].map((index) => {
                  const player = room.players[index];
                  return (
                    <div className="outdoor-room-player" key={index}>
                      <AvatarVisual className="avatar" value={player?.avatar} fallback="⏳" />
                      <div className="grow">
                        <strong>{player ? `${player.name}${player.id === playerId ? ' · tú' : ''}` : 'Esperando jugador…'}</strong>
                        <small>{player ? 'Listo' : 'La cola sigue abierta'}</small>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="game-actions">
                <button type="button" className="btn btn-ghost" onClick={leave}>
                  Salir del torneo
                </button>
              </div>
            </section>
          ) : null}

          {room.status !== 'waiting' ? (
            <section className="section" style={{ marginTop: 8 }}>
              <div className="section-head">
                <div>
                  <h2>Cuadro</h2>
                  <p>{me ? `Estás dentro como ${me.name}` : 'Sigue los cruces'}</p>
                </div>
              </div>
              <div className="tournament-bracket">
                {room.matches.map((match, index) => {
                  const mine = match.a === playerId || match.b === playerId;
                  const active = !match.winner;
                  return (
                    <div
                      key={match.id}
                      className={`tournament-match ${mine ? 'is-mine' : ''} ${match.round === 1 ? 'final-match' : ''} ${match.winner ? 'is-done' : ''}`}
                    >
                      <div className="tournament-match-head">
                        <span>{match.round === 0 ? `Semifinal ${index + 1}` : 'Final'}</span>
                        {active && match.game ? (
                          <span className="badge live">
                            <Icon name="timer" size={11} /> {Math.max(0, Math.ceil((match.game.deadline - now) / 1000))}s
                          </span>
                        ) : null}
                        <span className="badge">{match.winner ? 'Decidido' : 'En juego'}</span>
                      </div>
                      <div className="tournament-versus">
                        <span className="player">
                          <AvatarVisual className="avatar-inline" value={avatarOf(match.a)} fallback="❔" />
                          <strong>{nameOf(match.a)}</strong>
                        </span>
                        <span className="vs">VS</span>
                        <span className="player">
                          <AvatarVisual className="avatar-inline" value={avatarOf(match.b)} fallback="❔" />
                          <strong>{nameOf(match.b)}</strong>
                        </span>
                      </div>
                      {match.game ? renderBoard(match) : <p className="tinytip">Esperando rivales…</p>}
                      {match.winner ? (
                        <p className="tiny-note" style={{ marginBottom: 0 }}>
                          Pasa <strong>{nameOf(match.winner)}</strong>
                        </p>
                      ) : mine ? (
                        <p className="tiny-note" style={{ marginBottom: 0 }}>
                          {match.game && match.game.kind !== 'trivia' && match.game.state.turn === (match.a === playerId ? 0 : 1)
                            ? 'Tu turno'
                            : `Turno de ${nameOf(match.a === playerId ? match.b : match.a)}`}
                        </p>
                      ) : (
                        <p className="tiny-note" style={{ marginBottom: 0 }}>
                          Este cruce no es tuyo. Puedes seguir el tablero.
                        </p>
                      )}
                    </div>
                  );
                })}
                {room.status === 'playing' && room.matches.length === 2 ? (
                  <div className="tournament-match final-match">
                    <div className="tournament-match-head">
                      <span>Final</span>
                      <span className="badge">Por decidir</span>
                    </div>
                    <p className="tiny-note">Se juega cuando terminen las dos semifinales.</p>
                  </div>
                ) : null}
              </div>

              {room.status === 'ended' && champion ? (
                <div className="tournament-champion">
                  <span className="big" aria-hidden="true">
                    🏆
                  </span>
                  <h2>{champion.id === playerId ? '¡Ganaste el torneo!' : `Gana ${champion.name}`}</h2>
                  <p>{room.gameTitle} · torneo de 4 jugadores</p>
                  <button type="button" className="btn btn-primary btn-wide" onClick={leave}>
                    Volver a las salas
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="section">
            <SocialChat
              title="Chat del torneo"
              subtitle="Los 4 jugadores de la sala"
              messages={room.chat.map((message) => ({ ...message }))}
              meId={playerId ?? ''}
              people={chatPeople}
              muteScope={`tournament-${room.code}`}
              filter={state.filter}
              onSend={(text) => {
                socket.emit('tournament:chat', { code: room.code, text }, (response) => {
                  if (!response.ok) flash(response.error ?? 'No se pudo enviar.');
                });
              }}
              onReport={(target, reason) =>
                socket.emit(
                  'report:send',
                  { context: 'tournament', code: room.code, targetId: target.id, targetName: target.name, reason },
                  (response) => flash(response.ok ? 'Reporte enviado.' : response.error ?? 'No se pudo enviar.')
                )
              }
              emptyText="Aún no hay mensajes. Preséntate y juega limpio."
            />
          </section>

          <div className="play-footer">
            <button type="button" className="btn btn-ghost btn-wide" onClick={leave}>
              Salir del torneo
            </button>
          </div>
        </>
      )}
    </div>
  );
}
