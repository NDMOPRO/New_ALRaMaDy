/* ═══════════════════════════════════════════════════════════════
   LibraryEngine — Central File Library for All Services
   Features:
   - Unified file library for all engines
   - Categories: Excel, Presentations, Reports, Dashboards, Extractions, Translations
   - File preview, search, filter, sort
   - Drag files to any engine
   - Tags, favorites, recent
   - Storage stats
   - Ultra-premium UI
   ═══════════════════════════════════════════════════════════════ */
import { useState, useCallback, useMemo, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import MaterialIcon from './MaterialIcon';
import ModeSwitcher from './ModeSwitcher';
import { useTheme } from '@/contexts/ThemeContext';

/* ---------- Types ---------- */
interface LibraryFile {
  id: string;
  name: string;
  type: 'excel' | 'presentation' | 'report' | 'dashboard' | 'extraction' | 'translation' | 'image' | 'pdf' | 'audio' | 'video' | 'other';
  engine: string;
  size: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  favorite: boolean;
  preview?: string;
  status: 'ready' | 'processing' | 'draft';
}

type ViewMode = 'grid' | 'list' | 'compact';
type SortBy = 'name' | 'date' | 'size' | 'type';
type FilterCategory = 'all' | 'excel' | 'presentation' | 'report' | 'dashboard' | 'extraction' | 'translation' | 'favorites';

const uid = () => Math.random().toString(36).slice(2, 9);

/* ---------- File Type Config ---------- */
const FILE_TYPES: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  excel: { icon: 'grid_on', color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'إكسل' },
  presentation: { icon: 'slideshow', color: 'text-purple-500', bg: 'bg-purple-500/10', label: 'عرض' },
  report: { icon: 'description', color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'تقرير' },
  dashboard: { icon: 'dashboard', color: 'text-orange-500', bg: 'bg-orange-500/10', label: 'لوحة' },
  extraction: { icon: 'document_scanner', color: 'text-cyan-500', bg: 'bg-cyan-500/10', label: 'تفريغ' },
  translation: { icon: 'translate', color: 'text-pink-500', bg: 'bg-pink-500/10', label: 'ترجمة' },
  image: { icon: 'image', color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'صورة' },
  pdf: { icon: 'picture_as_pdf', color: 'text-red-500', bg: 'bg-red-500/10', label: 'PDF' },
  audio: { icon: 'mic', color: 'text-green-500', bg: 'bg-green-500/10', label: 'صوت' },
  video: { icon: 'videocam', color: 'text-violet-500', bg: 'bg-violet-500/10', label: 'فيديو' },
  other: { icon: 'insert_drive_file', color: 'text-gray-500', bg: 'bg-gray-500/10', label: 'ملف' },
};


/* ---------- Category Filters ---------- */
const CATEGORIES: { id: FilterCategory; label: string; icon: string; count?: number }[] = [
  { id: 'all', label: 'الكل', icon: 'folder' },
  { id: 'excel', label: 'إكسل', icon: 'grid_on' },
  { id: 'presentation', label: 'عروض', icon: 'slideshow' },
  { id: 'report', label: 'تقارير', icon: 'description' },
  { id: 'dashboard', label: 'لوحات', icon: 'dashboard' },
  { id: 'extraction', label: 'تفريغ', icon: 'document_scanner' },
  { id: 'translation', label: 'ترجمة', icon: 'translate' },
  { id: 'favorites', label: 'المفضلة', icon: 'star' },
];

/* ========== Main Component ========== */
export default function LibraryEngine() {
  const { theme } = useTheme();

  // State
  const [mode, setMode] = useState<'easy' | 'advanced'>('easy');
  const [files, setFiles] = useState<LibraryFile[]>([]);

  // Load files from DB
  const { data: dbFiles } = trpc.library.items.useQuery();
  const { data: dbUserFiles } = trpc.files.list.useQuery();

  useEffect(() => {
    const allFiles: LibraryFile[] = [];

    // Add library items from DB
    if (dbFiles && Array.isArray(dbFiles)) {
      dbFiles.forEach((f: any) => {
        allFiles.push({
          id: String(f.id),
          name: f.title || f.name || 'ملف',
          type: f.type || 'other',
          engine: f.engine || 'مكتبة',
          size: f.size || '—',
          sizeBytes: f.sizeBytes || 0,
          createdAt: f.createdAt ? new Date(f.createdAt).toLocaleDateString('ar-SA') : '—',
          updatedAt: f.updatedAt ? new Date(f.updatedAt).toLocaleDateString('ar-SA') : '—',
          tags: f.tags ? (typeof f.tags === 'string' ? JSON.parse(f.tags) : f.tags) : [],
          favorite: !!f.favorite,
          status: f.status || 'ready',
        });
      });
    }

    // Add uploaded files from DB
    if (dbUserFiles && Array.isArray(dbUserFiles)) {
      dbUserFiles.forEach((f: any) => {
        const ext = (f.name || '').split('.').pop()?.toLowerCase() || '';
        let type: LibraryFile['type'] = 'other';
        if (['xlsx', 'xls', 'csv'].includes(ext)) type = 'excel';
        else if (['pptx', 'ppt'].includes(ext)) type = 'presentation';
        else if (['pdf'].includes(ext)) type = 'pdf';
        else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) type = 'image';
        else if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) type = 'audio';
        else if (['mp4', 'avi', 'mov', 'webm'].includes(ext)) type = 'video';

        allFiles.push({
          id: `file-${f.id}`,
          name: f.name || 'ملف',
          type,
          engine: 'ملفات مرفوعة',
          size: f.size ? `${(f.size / 1024).toFixed(0)} KB` : '—',
          sizeBytes: f.size || 0,
          createdAt: f.createdAt ? new Date(f.createdAt).toLocaleDateString('ar-SA') : '—',
          updatedAt: f.updatedAt ? new Date(f.updatedAt).toLocaleDateString('ar-SA') : '—',
          tags: [],
          favorite: false,
          status: 'ready',
        });
      });
    }

    // If no DB data yet, show empty state (no sample data)
    setFiles(allFiles);
  }, [dbFiles, dbUserFiles]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [search, setSearch] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [previewFile, setPreviewFile] = useState<LibraryFile | null>(null);

  // Filtered and sorted files
  const filteredFiles = useMemo(() => {
    let result = [...files];

    // Filter by category
    if (filter === 'favorites') {
      result = result.filter(f => f.favorite);
    } else if (filter !== 'all') {
      result = result.filter(f => f.type === filter);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(f =>
        f.name.toLowerCase().includes(q) ||
        f.tags.some(t => t.includes(q)) ||
        f.engine.includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name': cmp = a.name.localeCompare(b.name, 'ar'); break;
        case 'size': cmp = a.sizeBytes - b.sizeBytes; break;
        case 'type': cmp = a.type.localeCompare(b.type); break;
        default: cmp = 0;
      }
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [files, filter, search, sortBy, sortAsc]);

  // Toggle favorite
  const toggleFavorite = useCallback((id: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, favorite: !f.favorite } : f));
  }, []);

  // Toggle selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Storage stats
  const totalSize = useMemo(() => {
    const bytes = files.reduce((sum, f) => sum + f.sizeBytes, 0);
    return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, [files]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    files.forEach(f => { counts[f.type] = (counts[f.type] || 0) + 1; });
    counts['favorites'] = files.filter(f => f.favorite).length;
    counts['all'] = files.length;
    return counts;
  }, [files]);

  return (
    <div className="flex-1 h-full bg-card rounded-2xl sm:rounded-3xl flex flex-col overflow-hidden shadow-xl relative gold-border-glow">
      {/* Top gold accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] gold-accent-line z-10" />
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-1 px-2 sm:px-3 py-2 border-b border-border/50 shrink-0 overflow-x-auto no-scrollbar glass">
        <ModeSwitcher mode={mode} onToggle={setMode} />
        <div className="h-4 w-px bg-border mx-0.5" />

        {/* View Mode */}
        {[
          { id: 'grid' as ViewMode, icon: 'grid_view' },
          { id: 'list' as ViewMode, icon: 'view_list' },
          { id: 'compact' as ViewMode, icon: 'density_small' },
        ].map(v => (
          <button
            key={v.id}
            onClick={() => setViewMode(v.id)}
            className={`p-1 rounded-lg transition-all ${viewMode === v.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'}`}
          >
            <MaterialIcon icon={v.icon} size={14} />
          </button>
        ))}

        <div className="h-4 w-px bg-border mx-0.5" />

        {/* Sort */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as SortBy)}
          className="text-[10px] bg-accent/30 border border-border/50 rounded-lg px-1.5 py-1 outline-none text-foreground"
        >
          <option value="date">بالتاريخ</option>
          <option value="name">بالاسم</option>
          <option value="size">بالحجم</option>
          <option value="type">بالنوع</option>
        </select>
        <button onClick={() => setSortAsc(!sortAsc)} className="p-1 rounded-lg text-muted-foreground hover:bg-accent transition-all">
          <MaterialIcon icon={sortAsc ? 'arrow_upward' : 'arrow_downward'} size={12} />
        </button>

        <div className="flex-1" />

        {/* Search */}
        <div className="flex items-center gap-1 bg-accent/30 rounded-lg px-2 py-1 max-w-[200px]">
          <MaterialIcon icon="search" size={12} className="text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث..."
            className="bg-transparent text-[10px] outline-none text-foreground placeholder:text-muted-foreground w-full"
          />
        </div>

        {/* Stats */}
        <span className="text-[9px] text-muted-foreground whitespace-nowrap">{files.length} ملف • {totalSize}</span>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Categories */}
        <div className="w-[140px] sm:w-[160px] border-l border-border flex flex-col shrink-0 overflow-y-auto">
          <div className="px-2 py-1.5 border-b border-border/50">
            <span className="text-[10px] font-bold text-muted-foreground">التصنيفات</span>
          </div>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setFilter(cat.id)}
              className={`flex items-center gap-1.5 px-2 py-1.5 text-right transition-all ${
                filter === cat.id ? 'bg-primary/5 text-primary border-r-2 border-primary' : 'text-muted-foreground hover:bg-accent/20'
              }`}
            >
              <MaterialIcon icon={cat.icon} size={14} />
              <span className="text-[10px] font-medium flex-1">{cat.label}</span>
              <span className="text-[8px] px-1 py-0.5 rounded bg-accent">{categoryCounts[cat.id] || 0}</span>
            </button>
          ))}

          {/* Storage Stats */}
          <div className="mt-auto p-2 border-t border-border/50">
            <div className="flex items-center gap-1 mb-1">
              <MaterialIcon icon="cloud" size={12} className="text-primary" />
              <span className="text-[9px] font-medium text-foreground">التخزين</span>
            </div>
            <div className="h-1.5 bg-accent rounded-full overflow-hidden mb-1">
              <div className="h-full bg-primary rounded-full" style={{ width: '35%' }} />
            </div>
            <span className="text-[8px] text-muted-foreground">{totalSize} من 1 GB</span>
          </div>
        </div>

        {/* Files Grid/List */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-3">
          {filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground/30">
              <MaterialIcon icon="folder_open" size={48} />
              <p className="text-[12px] mt-2">لا توجد ملفات</p>
            </div>
          ) : viewMode === 'grid' ? (
            /* Grid View */
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {filteredFiles.map((file, i) => {
                const typeConfig = FILE_TYPES[file.type] || FILE_TYPES.other;
                return (
                  <div
                    key={file.id}
                    className={`group relative flex flex-col items-center p-3 rounded-xl border transition-all cursor-pointer animate-stagger-in hover:shadow-md ${
                      selectedFiles.has(file.id) ? 'border-primary bg-primary/5' : 'border-border/30 hover:border-primary/20'
                    }`}
                    style={{ animationDelay: `${i * 0.03}s` }}
                    onClick={() => setPreviewFile(file)}
                    draggable
                  >
                    {/* Favorite */}
                    <button
                      onClick={e => { e.stopPropagation(); toggleFavorite(file.id); }}
                      className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MaterialIcon icon={file.favorite ? 'star' : 'star_border'} size={14} className={file.favorite ? 'text-warning' : 'text-muted-foreground'} />
                    </button>

                    {/* Select */}
                    <button
                      onClick={e => { e.stopPropagation(); toggleSelect(file.id); }}
                      className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MaterialIcon icon={selectedFiles.has(file.id) ? 'check_box' : 'check_box_outline_blank'} size={14} className={selectedFiles.has(file.id) ? 'text-primary' : 'text-muted-foreground'} />
                    </button>

                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-xl ${typeConfig.bg} flex items-center justify-center mb-2 group-hover:scale-110 transition-transform`}>
                      <MaterialIcon icon={typeConfig.icon} size={24} className={typeConfig.color} />
                    </div>

                    {/* Name */}
                    <p className="text-[10px] font-medium text-foreground text-center truncate w-full">{file.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[8px] text-muted-foreground">{file.size}</span>
                      {file.status === 'processing' && (
                        <MaterialIcon icon="progress_activity" size={8} className="text-primary animate-spin" />
                      )}
                    </div>

                    {/* Tags */}
                    {file.tags.length > 0 && (
                      <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                        {file.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="text-[7px] px-1 py-0.5 rounded bg-accent text-muted-foreground">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : viewMode === 'list' ? (
            /* List View */
            <div className="flex flex-col gap-1">
              {filteredFiles.map((file, i) => {
                const typeConfig = FILE_TYPES[file.type] || FILE_TYPES.other;
                return (
                  <div
                    key={file.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all cursor-pointer animate-stagger-in hover:shadow-sm ${
                      selectedFiles.has(file.id) ? 'border-primary bg-primary/5' : 'border-border/30 hover:border-primary/20'
                    }`}
                    style={{ animationDelay: `${i * 0.02}s` }}
                    onClick={() => setPreviewFile(file)}
                    draggable
                  >
                    <button onClick={e => { e.stopPropagation(); toggleSelect(file.id); }}>
                      <MaterialIcon icon={selectedFiles.has(file.id) ? 'check_box' : 'check_box_outline_blank'} size={14} className={selectedFiles.has(file.id) ? 'text-primary' : 'text-muted-foreground/30'} />
                    </button>
                    <div className={`w-8 h-8 rounded-lg ${typeConfig.bg} flex items-center justify-center shrink-0`}>
                      <MaterialIcon icon={typeConfig.icon} size={16} className={typeConfig.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-foreground truncate">{file.name}</p>
                      <div className="flex items-center gap-2 text-[8px] text-muted-foreground">
                        <span>{file.engine}</span>
                        <span>•</span>
                        <span>{file.updatedAt}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {file.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="text-[7px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground">{tag}</span>
                      ))}
                      <span className="text-[9px] text-muted-foreground w-16 text-left">{file.size}</span>
                      <button onClick={e => { e.stopPropagation(); toggleFavorite(file.id); }}>
                        <MaterialIcon icon={file.favorite ? 'star' : 'star_border'} size={14} className={file.favorite ? 'text-warning' : 'text-muted-foreground/30'} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Compact View */
            <div className="flex flex-col">
              {/* Header */}
              <div className="flex items-center gap-2 px-2 py-1 text-[8px] font-bold text-muted-foreground border-b border-border/30">
                <span className="w-5" />
                <span className="w-6" />
                <span className="flex-1">الاسم</span>
                <span className="w-20">المحرك</span>
                <span className="w-16">الحجم</span>
                <span className="w-20">التحديث</span>
                <span className="w-5" />
              </div>
              {filteredFiles.map((file, i) => {
                const typeConfig = FILE_TYPES[file.type] || FILE_TYPES.other;
                return (
                  <div
                    key={file.id}
                    className={`flex items-center gap-2 px-2 py-1 border-b border-border/10 hover:bg-accent/10 cursor-pointer transition-all animate-stagger-in ${
                      selectedFiles.has(file.id) ? 'bg-primary/5' : ''
                    }`}
                    style={{ animationDelay: `${i * 0.01}s` }}
                    onClick={() => setPreviewFile(file)}
                  >
                    <button onClick={e => { e.stopPropagation(); toggleSelect(file.id); }} className="w-5">
                      <MaterialIcon icon={selectedFiles.has(file.id) ? 'check_box' : 'check_box_outline_blank'} size={12} className={selectedFiles.has(file.id) ? 'text-primary' : 'text-muted-foreground/20'} />
                    </button>
                    <MaterialIcon icon={typeConfig.icon} size={12} className={typeConfig.color} />
                    <span className="flex-1 text-[10px] text-foreground truncate">{file.name}</span>
                    <span className="w-20 text-[8px] text-muted-foreground truncate">{file.engine}</span>
                    <span className="w-16 text-[8px] text-muted-foreground">{file.size}</span>
                    <span className="w-20 text-[8px] text-muted-foreground">{file.updatedAt}</span>
                    <button onClick={e => { e.stopPropagation(); toggleFavorite(file.id); }} className="w-5">
                      <MaterialIcon icon={file.favorite ? 'star' : 'star_border'} size={10} className={file.favorite ? 'text-warning' : 'text-muted-foreground/20'} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Preview Panel ── */}
      {previewFile && (
        <div className="border-t border-border bg-accent/5 p-3 shrink-0 animate-fade-in">
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-xl ${FILE_TYPES[previewFile.type]?.bg || 'bg-gray-500/10'} flex items-center justify-center`}>
              <MaterialIcon icon={FILE_TYPES[previewFile.type]?.icon || 'insert_drive_file'} size={20} className={FILE_TYPES[previewFile.type]?.color || 'text-gray-500'} />
            </div>
            <div className="flex-1">
              <p className="text-[12px] font-medium text-foreground">{previewFile.name}</p>
              <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                <span>{previewFile.engine}</span>
                <span>•</span>
                <span>{previewFile.size}</span>
                <span>•</span>
                <span>آخر تحديث: {previewFile.updatedAt}</span>
              </div>
            </div>
            <div className="flex gap-1">
              <button className="flex items-center gap-1 px-2 py-1 bg-accent rounded-lg text-[10px] font-medium hover:bg-accent/80 transition-all">
                <MaterialIcon icon="open_in_new" size={12} />فتح
              </button>
              <button className="flex items-center gap-1 px-2 py-1 bg-primary/8 text-primary rounded-lg text-[10px] font-medium hover:bg-primary/12 transition-all">
                <MaterialIcon icon="download" size={12} />تحميل
              </button>
              <button onClick={() => setPreviewFile(null)} className="p-1 hover:bg-accent rounded-lg transition-all">
                <MaterialIcon icon="close" size={14} className="text-muted-foreground" />
              </button>
            </div>
          </div>
          {previewFile.tags.length > 0 && (
            <div className="flex gap-1 mt-1.5">
              {previewFile.tags.map(tag => (
                <span key={tag} className="text-[8px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{tag}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Selection Actions ── */}
      {selectedFiles.size > 0 && (
        <div className="px-3 py-2 border-t border-border bg-primary/3 flex items-center gap-2 shrink-0 animate-fade-in">
          <span className="text-[10px] font-medium text-foreground">{selectedFiles.size} ملف محدد</span>
          <div className="flex-1" />
          <button className="flex items-center gap-1 px-2 py-1 bg-accent rounded-lg text-[10px] font-medium hover:bg-accent/80 transition-all">
            <MaterialIcon icon="drive_file_move" size={12} />نقل
          </button>
          <button className="flex items-center gap-1 px-2 py-1 bg-accent rounded-lg text-[10px] font-medium hover:bg-accent/80 transition-all">
            <MaterialIcon icon="download" size={12} />تحميل
          </button>
          <button className="flex items-center gap-1 px-2 py-1 bg-danger/10 text-danger rounded-lg text-[10px] font-medium hover:bg-danger/15 transition-all">
            <MaterialIcon icon="delete" size={12} />حذف
          </button>
          <button onClick={() => setSelectedFiles(new Set())} className="p-1 hover:bg-accent rounded-lg transition-all">
            <MaterialIcon icon="close" size={12} className="text-muted-foreground" />
          </button>
        </div>
      )}
    </div>
  );
}
