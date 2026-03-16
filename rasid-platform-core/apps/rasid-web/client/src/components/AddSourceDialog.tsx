/* RASID Visual DNA — Add Source Dialog
   Professional file upload with drag-and-drop, source type tabs, mobile-responsive
   Now wired to real /api/upload/single and /api/upload/multiple endpoints */
import { useState, useRef, useEffect, useCallback, type DragEvent, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import MaterialIcon from './MaterialIcon';

interface UploadedFile {
  id: number;
  title: string;
  url: string;
  category: string;
  size: string;
  status: string;
}

interface AddSourceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onFilesUploaded?: (files: UploadedFile[]) => void;
}

const sourceTypes = [
  { icon: 'upload_file', label: 'رفع ملفات', desc: 'PDF, Excel, Word, CSV' },
  { icon: 'link', label: 'رابط موقع', desc: 'استيراد من URL' },
  { icon: 'table_chart', label: 'جدول بيانات', desc: 'Google Sheets, Excel' },
  { icon: 'content_paste', label: 'نص منسوخ', desc: 'لصق نص مباشرة' },
  { icon: 'mic', label: 'ملف صوتي', desc: 'MP3, WAV, M4A' },
  { icon: 'videocam', label: 'فيديو', desc: 'MP4, WebM' },
];

export default function AddSourceDialog({ isOpen, onClose, onFilesUploaded }: AddSourceDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeType, setActiveType] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setPendingFiles([]);
      setUploadProgress(0);
      setIsUploading(false);
    }
  }, [isOpen]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(f => f.size <= 100 * 1024 * 1024); // 100MB max
    if (validFiles.length < fileArray.length) {
      toast.warning('بعض الملفات تجاوزت الحد الأقصى (100MB)');
    }
    setPendingFiles(prev => [...prev, ...validFiles]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const uploadFiles = useCallback(async () => {
    if (pendingFiles.length === 0) {
      toast.error('يرجى اختيار ملفات أولاً');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      if (pendingFiles.length === 1) {
        // Single file upload
        const formData = new FormData();
        formData.append('file', pendingFiles[0]);
        const res = await fetch('/api/upload/single', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'فشل الرفع' }));
          throw new Error(err.error || 'فشل الرفع');
        }
        const result = await res.json();
        setUploadProgress(100);
        toast.success(`تم رفع "${result.file.title}" بنجاح`);
        onFilesUploaded?.([result.file]);
      } else {
        // Multiple file upload
        const formData = new FormData();
        pendingFiles.forEach(f => formData.append('files', f));
        const res = await fetch('/api/upload/multiple', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'فشل الرفع' }));
          throw new Error(err.error || 'فشل الرفع');
        }
        const result = await res.json();
        setUploadProgress(100);
        toast.success(`تم رفع ${result.count} ملف بنجاح`);
        onFilesUploaded?.(result.files);
      }
      setTimeout(() => onClose(), 800);
    } catch (error: any) {
      toast.error(error.message || 'فشل رفع الملفات');
    } finally {
      setIsUploading(false);
    }
  }, [pendingFiles, onClose, onFilesUploaded]);

  if (!isOpen) return null;

  const handleDragOver = (e: DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-dialog-backdrop" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-popover w-full max-w-[520px] rounded-2xl overflow-hidden shadow-2xl animate-dialog-content max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <MaterialIcon icon="add_circle" size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-foreground">إضافة مصدر بيانات</h3>
              <p className="text-[10px] text-muted-foreground">ارفع ملفاتك أو أضف روابط لتبدأ التحليل</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent transition-all active:scale-95">
            <MaterialIcon icon="close" size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Search */}
          <div className="mb-4">
            <div className="flex items-center gap-2 h-10 border border-border rounded-xl px-3 focus-within:border-primary/40 focus-within:shadow-sm transition-all duration-200">
              <MaterialIcon icon="search" size={18} className="text-muted-foreground shrink-0" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ابحث عن مصادر أو الصق رابط..."
                className="flex-1 text-[12px] text-foreground placeholder:text-muted-foreground bg-transparent outline-none"
              />
            </div>
          </div>

          {/* Drop Zone */}
          <div
            className={`mb-5 flex flex-col items-center justify-center py-8 sm:py-10 rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer ${
              isDragging ? 'border-primary bg-primary/5 shadow-inner' : 'border-border hover:border-primary/30 hover:bg-accent/30'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <MaterialIcon icon="cloud_upload" size={36} className={isDragging ? 'text-primary animate-bounce-in' : 'text-muted-foreground/30'} />
            <p className="text-[13px] font-medium text-foreground mt-2.5">أسقط الملفات هنا</p>
            <p className="text-[11px] text-muted-foreground mt-1">أو اضغط لاختيار الملفات</p>
            <p className="text-[9px] text-muted-foreground/60 mt-1">الحد الأقصى: 100MB لكل ملف</p>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              onChange={handleFileSelect}
            />
          </div>

          {/* Pending Files List */}
          {pendingFiles.length > 0 && (
            <div className="mb-4">
              <label className="text-[11px] font-bold text-muted-foreground mb-2 block">
                الملفات المختارة ({pendingFiles.length})
              </label>
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {pendingFiles.map((file, i) => (
                  <div key={`${file.name}-${i}`} className="flex items-center gap-2 p-2 rounded-lg bg-accent/30 border border-border/50">
                    <MaterialIcon
                      icon={file.type.startsWith('image/') ? 'image' : file.type.includes('pdf') ? 'picture_as_pdf' : file.type.includes('spreadsheet') || file.type.includes('excel') ? 'table_chart' : 'insert_drive_file'}
                      size={16}
                      className="text-primary shrink-0"
                    />
                    <span className="flex-1 text-[11px] text-foreground truncate">{file.name}</span>
                    <span className="text-[9px] text-muted-foreground shrink-0">{formatSize(file.size)}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-destructive/10 transition-colors"
                    >
                      <MaterialIcon icon="close" size={12} className="text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <MaterialIcon icon="cloud_upload" size={14} className="text-primary animate-pulse" />
                <span className="text-[11px] text-foreground">جاري الرفع...</span>
              </div>
              <div className="w-full h-2 bg-accent rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Source Types Grid */}
          <div>
            <label className="text-[11px] font-bold text-muted-foreground mb-2 block">أو اختر نوع المصدر</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {sourceTypes.map((type, i) => (
                <button
                  key={type.label}
                  onClick={() => setActiveType(i)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all duration-200 active:scale-[0.97] animate-stagger-in ${
                    activeType === i
                      ? 'bg-primary/5 border-primary/30 text-primary'
                      : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  <MaterialIcon icon={type.icon} size={22} />
                  <span className="text-[11px] font-medium">{type.label}</span>
                  <span className="text-[8px] text-muted-foreground">{type.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-border gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-[12px] font-medium text-muted-foreground hover:bg-accent transition-all">
            إلغاء
          </button>
          <button
            onClick={uploadFiles}
            disabled={isUploading || pendingFiles.length === 0}
            className="px-5 py-2 bg-primary text-primary-foreground rounded-xl text-[12px] font-medium hover:opacity-90 transition-all duration-200 active:scale-[0.97] flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <MaterialIcon icon="sync" size={16} className="animate-spin" />
                جاري الرفع...
              </>
            ) : (
              <>
                <MaterialIcon icon="add" size={16} />
                إضافة {pendingFiles.length > 0 ? `(${pendingFiles.length})` : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
