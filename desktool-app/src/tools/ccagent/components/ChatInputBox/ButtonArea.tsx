// ButtonArea — 按钮区（对齐 cc-gui ButtonArea）
// Sprint B: 输入框底部的操作按钮（上传/增强/收藏/回退/导出/发送/停止）

interface ButtonAreaProps {
  onUploadImage: () => void;
  onEnhancePrompt: () => void;
  canEnhance: boolean;
  hasFavorites: boolean;
  onSaveFavorite: () => void;
  onLoadFavorite: (msg: string) => void;
  favorites: { id: string; name: string; message: string }[];
  hasMessages: boolean;
  streaming: boolean;
  onRewind: () => void;
  onExport: () => void;
  onSend: () => void;
  onAbort: () => void;
  canSend: boolean;
}

export function ButtonArea({
  onUploadImage, onEnhancePrompt, canEnhance,
  hasFavorites, onSaveFavorite, onLoadFavorite, favorites,
  hasMessages, streaming, onRewind, onExport, onSend, onAbort, canSend,
}: ButtonAreaProps) {
  return (
    <div className="cc-input-actions">
      <button className="cc-input-btn" onClick={onUploadImage} title="上传图片">🖼️</button>
      <button className="cc-input-btn" onClick={onEnhancePrompt} disabled={!canEnhance} title="提示词增强">✨</button>

      {hasFavorites && (
        <select className="cc-fav-select" onChange={e => e.target.value && onLoadFavorite(e.target.value)} value="">
          <option value="">⭐ 收藏 ({favorites.length})</option>
          {favorites.map(f => <option key={f.id} value={f.message}>{f.name}</option>)}
        </select>
      )}
      <button className="cc-input-btn" onClick={onSaveFavorite} disabled={!canEnhance} title="收藏当前输入">⭐</button>

      <div style={{ flex: 1 }} />

      {hasMessages && <button className="cc-input-btn" onClick={onRewind} disabled={streaming}>⏪ 回退</button>}
      <button className="cc-input-btn" onClick={onExport} disabled={!hasMessages}>📤 导出</button>
      {streaming ? (
        <button className="cc-stop-btn" onClick={onAbort}>⏹ 停止</button>
      ) : (
        <button className="cc-send-btn" onClick={onSend} disabled={!canSend}>发送 →</button>
      )}
    </div>
  );
}
