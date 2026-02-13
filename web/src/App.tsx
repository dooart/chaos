import { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import './App.css'

// Types
interface Note {
  id: string
  title: string
  status: string | null
  tags: string[]
  filename: string
  mtime: number
}

interface NoteDetail extends Note {
  content: string
  body: string
  resolvedBody: string
  project: string | null
}

interface PrdStory {
  id: number
  title: string
  description: string
  acceptanceCriteria: string[]
  dependsOn: number[]
  status: 'pending' | 'done'
}

interface ProjectData {
  hasProject: boolean
  hasPrd?: boolean
  valid?: boolean
  stories?: PrdStory[]
  errors?: string[]
  error?: string
}

interface Toast {
  id: number
  type: 'success' | 'error'
  message: string
}

// Toast context
const ToastContext = createContext<{
  addToast: (type: 'success' | 'error', message: string) => void
}>({ addToast: () => {} })

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  
  const addToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = Date.now()
    setToasts((t) => [...t, { id, type, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])
  
  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const useToast = () => useContext(ToastContext)

// API helpers
const api = {
  async checkAuth(): Promise<boolean> {
    const res = await fetch('/chaos/auth/status')
    const data = await res.json()
    return data.authenticated
  },
  
  async login(username: string, password: string): Promise<boolean> {
    const res = await fetch('/chaos/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    return res.ok
  },
  
  async logout(): Promise<void> {
    await fetch('/chaos/auth/logout', { method: 'POST' })
  },
  
  async getNotes(page: number, limit: number, search: string): Promise<{
    notes: Note[]
    total: number
    hasMore: boolean
  }> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (search) params.set('search', search)
    const res = await fetch(`/chaos/api/notes?${params}`)
    if (!res.ok) throw new Error('Failed to fetch notes')
    return res.json()
  },
  
  async getNote(id: string): Promise<NoteDetail> {
    const res = await fetch(`/chaos/api/notes/${id}`)
    if (!res.ok) throw new Error('Failed to fetch note')
    return res.json()
  },
  
  async createNote(title: string): Promise<{ id: string }> {
    const res = await fetch('/chaos/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to create note')
    }
    return res.json()
  },
  
  async updateNote(id: string, content: string): Promise<void> {
    const res = await fetch(`/chaos/api/notes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to update note')
    }
  },
  
  async renameNote(id: string, title: string): Promise<void> {
    const res = await fetch(`/chaos/api/notes/${id}/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to rename note')
    }
  },
  
  async deleteNote(id: string): Promise<void> {
    const res = await fetch(`/chaos/api/notes/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to delete note')
    }
  },

  async getProject(noteId: string): Promise<ProjectData> {
    const res = await fetch(`/chaos/api/notes/${noteId}/project`)
    return res.json()
  },
}

// Login component
function Login({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const success = await api.login(username, password)
    if (success) {
      onLogin()
    } else {
      setError('Invalid credentials')
    }
  }
  
  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h1>🌀 Chaos</h1>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="error">{error}</p>}
        <button type="submit">Login</button>
      </form>
    </div>
  )
}

// Note list component
function NoteList({
  onSelectNote,
  selectedId,
}: {
  onSelectNote: (id: string | null) => void
  selectedId: string | null
}) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showNewModal, setShowNewModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const queryClient = useQueryClient()
  const { addToast } = useToast()
  
  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 200)
    return () => clearTimeout(timer)
  }, [search])
  
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['notes', debouncedSearch],
    queryFn: ({ pageParam = 1 }) => api.getNotes(pageParam, 20, debouncedSearch),
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore ? pages.length + 1 : undefined,
    initialPageParam: 1,
  })
  
  const createMutation = useMutation({
    mutationFn: (title: string) => api.createNote(title),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      setShowNewModal(false)
      setNewTitle('')
      onSelectNote(data.id)
      addToast('success', 'Note created')
    },
    onError: (e: Error) => addToast('error', e.message),
  })
  
  const notes = data?.pages.flatMap((p) => p.notes) || []
  
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    if (scrollHeight - scrollTop <= clientHeight * 1.5 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }
  
  return (
    <div className="note-list">
      <div className="list-header">
        <input
          type="text"
          placeholder="Search notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <button className="new-btn" onClick={() => setShowNewModal(true)}>
          + New
        </button>
      </div>
      
      <div className="notes-container" onScroll={handleScroll}>
        {isLoading ? (
          <p className="loading">Loading...</p>
        ) : notes.length === 0 ? (
          <p className="empty">No notes found</p>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className={`note-item ${selectedId === note.id ? 'selected' : ''}`}
              onClick={() => onSelectNote(note.id)}
            >
              <span className="note-title">{note.title}</span>
              {note.status && (
                <span className={`note-status status-${note.status}`}>
                  {note.status}
                </span>
              )}
            </div>
          ))
        )}
        {isFetchingNextPage && <p className="loading">Loading more...</p>}
      </div>
      
      {showNewModal && (
        <div className="modal-overlay" onClick={() => setShowNewModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>New Note</h2>
            <input
              type="text"
              placeholder="Note title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTitle.trim()) {
                  createMutation.mutate(newTitle.trim())
                }
              }}
            />
            <div className="modal-actions">
              <button onClick={() => setShowNewModal(false)}>Cancel</button>
              <button
                className="primary"
                onClick={() => newTitle.trim() && createMutation.mutate(newTitle.trim())}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Simple markdown to HTML (basic)
// Process [[id]] and [[id|text]] links before rendering
function processInternalLinks(text: string): string {
  return text
    .replace(/\[\[([a-z0-9]{21})\|([^\]]+)\]\]/g, '[$2](/chaos/note/$1)')
    .replace(/\[\[([a-z0-9]{21})\]\]/g, '[[$1]]')
}

// Backlog component
function Backlog({ noteId }: { noteId: string }) {
  const [tab, setTab] = useState<'pending' | 'done' | 'live'>('pending')

  const { data, isLoading } = useQuery({
    queryKey: ['project', noteId],
    queryFn: () => api.getProject(noteId),
  })

  if (isLoading) {
    return <div className="backlog-container"><p className="loading">Loading project...</p></div>
  }

  if (!data || !data.hasProject) {
    return (
      <div className="backlog-container">
        <div className="backlog-warning">No project linked to this note.</div>
      </div>
    )
  }

  if (!data.hasPrd) {
    return (
      <div className="backlog-container">
        <div className="backlog-warning">No prd.json found at project root.</div>
      </div>
    )
  }

  if (!data.valid) {
    return (
      <div className="backlog-container">
        <div className="backlog-warning">
          <strong>prd.json is not compatible:</strong>
          <ul>
            {(data.errors || []).map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  const stories = data.stories || []
  const doneIds = new Set(stories.filter(s => s.status === 'done').map(s => s.id))
  const pending = stories.filter(s => s.status === 'pending')
  const done = stories.filter(s => s.status === 'done')
  const visible = tab === 'pending' ? pending : tab === 'done' ? done : []

  return (
    <div className="backlog-container">
      <div className="backlog-tabs">
        <button
          className={tab === 'pending' ? 'active' : ''}
          onClick={() => setTab('pending')}
        >
          Pending{pending.length > 0 && ` (${pending.length})`}
        </button>
        <button
          className={tab === 'done' ? 'active' : ''}
          onClick={() => setTab('done')}
        >
          Done{done.length > 0 && ` (${done.length})`}
        </button>
        <button
          className={tab === 'live' ? 'active' : ''}
          onClick={() => setTab('live')}
        >
          Live
        </button>
      </div>
      {tab === 'live' ? (
        <LiveView noteId={noteId} />
      ) : visible.length === 0 ? (
        <p className="backlog-empty">
          {tab === 'pending' ? 'No pending stories.' : 'No completed stories.'}
        </p>
      ) : (
        <div className="backlog-stories">
          {visible.map((story, index) => {
            const blocked = story.dependsOn.some(dep => !doneIds.has(dep))
            const blockedBy = story.dependsOn.filter(dep => !doneIds.has(dep))
            return (
              <div key={story.id} className={`backlog-story ${blocked ? 'blocked' : ''}`}>
                <div className="story-header">
                  <span className="story-position">#{index + 1}</span>
                  <span className="story-title">{story.title}</span>
                  <span className={`story-status status-${story.status}`}>{story.status}</span>
                </div>
                {blocked && (
                  <div className="story-blocked">
                    Blocked by {blockedBy.map(id => `#${stories.findIndex(s => s.id === id) + 1}`).join(', ')}
                  </div>
                )}
                {story.description && (
                  <p className="story-description">{story.description}</p>
                )}
                {story.acceptanceCriteria.length > 0 && (
                  <ul className="story-criteria">
                    {story.acceptanceCriteria.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                )}
                {story.dependsOn.length > 0 && (
                  <div className="story-deps">
                    Depends on: {story.dependsOn.map(id => `#${stories.findIndex(s => s.id === id) + 1}`).join(', ')}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Live view component — streams logs and progress from wile
function LiveView({ noteId }: { noteId: string }) {
  const [progress, setProgress] = useState('')
  const [logContent, setLogContent] = useState('')
  const [logFiles, setLogFiles] = useState<string[]>([])
  const [currentLog, setCurrentLog] = useState('')
  const [selectedLog, setSelectedLog] = useState('')
  const [lastActivity, setLastActivity] = useState<number | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [connected, setConnected] = useState(false)
  const logRef = useRef<HTMLPreElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Auto-scroll effect
  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logContent, autoScroll])

  // SSE connection
  useEffect(() => {
    const logParam = selectedLog ? `?log=${encodeURIComponent(selectedLog)}` : ''
    const url = `/chaos/api/notes/${noteId}/project/stream${logParam}`
    const es = new EventSource(url)
    eventSourceRef.current = es

    let initialProgressReceived = false
    es.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data)
      const isFirst = !initialProgressReceived
      initialProgressReceived = true
      setProgress(data.content)
      // Only count as activity if it's an update, not the initial load
      if (!isFirst) setLastActivity(Date.now())
    })

    es.addEventListener('log', (e) => {
      const data = JSON.parse(e.data)
      if (data.initial) {
        setLogContent(data.chunk)
        // Use the file's actual mtime for initial activity timestamp
        if (data.lastModified) setLastActivity(data.lastModified)
      } else {
        setLogContent((prev) => prev + data.chunk)
        setLastActivity(Date.now())
      }
      if (data.file) setCurrentLog(data.file)
    })

    es.addEventListener('logFiles', (e) => {
      const data = JSON.parse(e.data)
      setLogFiles(data.files)
      if (data.current) setCurrentLog(data.current)
      setConnected(true)
    })

    es.addEventListener('prd', () => {
      setLastActivity(Date.now())
    })

    es.onerror = () => {
      setConnected(false)
    }

    return () => {
      es.close()
      eventSourceRef.current = null
    }
  }, [noteId, selectedLog])

  // Handle scroll — pause auto-scroll when user scrolls up
  const handleLogScroll = useCallback(() => {
    if (!logRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = logRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
    setAutoScroll(isAtBottom)
  }, [])

  // Don't clear content on log switch — just swap selection, SSE reconnects and sends initial
  const handleLogSelect = (file: string) => {
    setSelectedLog(file)
    setCurrentLog(file)
  }

  // Format last activity as relative time
  const activityLabel = (() => {
    if (!connected) return 'Connecting...'
    if (!lastActivity) return 'No activity'
    const ago = Math.floor((Date.now() - lastActivity) / 1000)
    if (ago < 5) return 'Active now'
    if (ago < 60) return `${ago}s ago`
    if (ago < 3600) return `${Math.floor(ago / 60)}m ago`
    return `${Math.floor(ago / 3600)}h ago`
  })()

  // Re-render the label periodically
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 5000)
    return () => clearInterval(t)
  }, [])

  const isRecent = lastActivity != null && Date.now() - lastActivity < 30000

  return (
    <div className="live-container">
      <div className="live-header">
        <div className="live-status">
          <span className={`live-dot ${isRecent ? 'active' : 'idle'}`} />
          <span className="live-label">{activityLabel}</span>
        </div>
        <select
          className="live-log-select"
          value={selectedLog || currentLog || ''}
          onChange={(e) => handleLogSelect(e.target.value)}
          disabled={logFiles.length === 0}
        >
          {logFiles.length === 0 ? (
            <option value="">No logs</option>
          ) : (
            logFiles.map((f) => (
              <option key={f} value={f}>
                {f.replace(/\.log$/, '').replace(/[-_]/g, ' ')}
              </option>
            ))
          )}
        </select>
      </div>

      <details className="live-progress" open>
        <summary>Progress</summary>
        <div className="live-progress-content">
          {progress ? (
            <Markdown remarkPlugins={[remarkGfm]}>{progress}</Markdown>
          ) : (
            <p className="live-empty-text">No progress yet</p>
          )}
        </div>
      </details>

      <div className="live-log-wrapper">
        <div className="live-log-toolbar">
          <span className="live-log-filename">{currentLog || 'No logs'}</span>
          {!autoScroll && (
            <button
              className="live-scroll-btn"
              onClick={() => {
                setAutoScroll(true)
                if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
              }}
            >
              ↓ Scroll to bottom
            </button>
          )}
        </div>
        <pre
          ref={logRef}
          className="live-log"
          onScroll={handleLogScroll}
        >
          {logContent || <span className="live-log-empty">No log output yet</span>}
        </pre>
      </div>
    </div>
  )
}

// Note editor component
function NoteEditor({
  noteId,
  onClose,
  onNavigate,
}: {
  noteId: string
  onClose: () => void
  onNavigate: (id: string) => void
}) {
  const [editedContent, setEditedContent] = useState<string | null>(null)
  const [editedTitle, setEditedTitle] = useState<string | null>(null)
  const [editedStatus, setEditedStatus] = useState<string>('')
  const [editedTags, setEditedTags] = useState<string[]>([])
  const [tagsInput, setTagsInput] = useState<string>('')
  const [isEditingTags, setIsEditingTags] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [viewMode, setViewMode] = useState<'preview' | 'edit' | 'backlog'>('preview')
  // state sync handled below
  const queryClient = useQueryClient()
  const { addToast } = useToast()
  
  const { data: note, isLoading } = useQuery({
    queryKey: ['note', noteId],
    queryFn: () => api.getNote(noteId),
  })

  useEffect(() => {
    if (note) {
      setEditedStatus(note.status ?? '')
      setEditedTags(note.tags ?? [])
      setTagsInput((note.tags ?? []).join(' '))
      setEditedContent(null)
      setEditedTitle(null)
      setIsEditingTags(false)
      document.title = `${note.title} - Chaos`
    }
    return () => { document.title = 'Chaos' }
  }, [noteId, note])
  
  const updateMutation = useMutation({
    mutationFn: ({ content, title, hasBodyMetaChange }: { content: string; title: string; hasBodyMetaChange: boolean }) => {
      const titleChanged = title !== note?.title
      if (titleChanged) {
        return api.renameNote(noteId, title).then(() => {
          if (hasBodyMetaChange) {
            return api.updateNote(noteId, content)
          }
        })
      }
      if (hasBodyMetaChange) {
        return api.updateNote(noteId, content)
      }
      return Promise.resolve()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['note', noteId] })
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      setEditedContent(null)
      setEditedTitle(null)
      addToast('success', 'Saved')
    },
    onError: (e: Error) => addToast('error', e.message),
  })
  
  const deleteMutation = useMutation({
    mutationFn: () => api.deleteNote(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      onClose()
      addToast('success', 'Note deleted')
    },
    onError: (e: Error) => addToast('error', e.message),
  })
  
  const currentBody = editedContent ?? note?.body ?? ''
  const currentTitle = editedTitle ?? note?.title ?? ''
  const hasTitleChange = editedTitle !== null && editedTitle !== (note?.title ?? '')
  const hasStatusChange = editedStatus !== (note?.status ?? '')
  const hasTagsChange = (editedTags.join(' ') !== (note?.tags ?? []).join(' '))
  const hasBodyMetaChange = editedContent !== null || hasStatusChange || hasTagsChange
  const hasChanges = hasTitleChange || hasBodyMetaChange

  const buildContent = () => {
    if (!note) return ''
    const statusLine = editedStatus ? `status: ${editedStatus}\n` : ''
    const tagsLine = editedTags.length ? `tags: [${editedTags.join(', ')}]\n` : ''
    return `---\nid: ${note.id}\ntitle: ${currentTitle}\n${statusLine}${tagsLine}---\n\n${currentBody}`
  }

  const previewBody = currentBody

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (hasChanges && note) {
          updateMutation.mutate({
            content: buildContent(),
            title: currentTitle,
            hasBodyMetaChange,
          })
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  if (isLoading || !note) {
    return <div className="editor-container"><p className="loading">Loading...</p></div>
  }
  
  return (
    <div className="editor-container">
      <div className="editor-header">
        <div className="header-title-row">
          <input
            type="text"
            className={`title-input ${editedTitle !== null ? 'modified' : ''}`}
            value={currentTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
          />
          <button className="close-btn mobile-close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>
        <div className="editor-actions">
          <div className="editor-actions-left">
            {hasChanges && <span className="unsaved-indicator">Unsaved</span>}
            <button
              className="save-btn"
              onClick={() =>
                updateMutation.mutate({
                  content: buildContent(),
                  title: currentTitle,
                  hasBodyMetaChange,
                })
              }
              disabled={!hasChanges || updateMutation.isPending}
              title="Save"
            >
              <svg className="btn-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3.5 3.5L13 4"/></svg>
              <span className="btn-label">{updateMutation.isPending ? 'Saving...' : 'Save'}</span>
            </button>
            <button className="delete-btn" onClick={() => setShowDeleteModal(true)} title="Delete">
              <svg className="btn-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4h12"/><path d="M5.33 4V2.67a1.33 1.33 0 0 1 1.34-1.34h2.66a1.33 1.33 0 0 1 1.34 1.34V4"/><path d="M12.67 4v9.33a1.33 1.33 0 0 1-1.34 1.34H4.67a1.33 1.33 0 0 1-1.34-1.34V4"/></svg>
              <span className="btn-label">Delete</span>
            </button>
          </div>
          <div className="editor-actions-right desktop-only">
            <button className="close-btn" onClick={onClose} title="Close">
              ✕
            </button>
          </div>
        </div>
      </div>
      
      <div className="view-toggle">
        <div className="view-toggle-tabs">
          <button
            className={viewMode === 'preview' ? 'active' : ''}
            onClick={() => setViewMode('preview')}
          >
            Preview
          </button>
          <button
            className={viewMode === 'edit' ? 'active' : ''}
            onClick={() => setViewMode('edit')}
          >
            Edit
          </button>
          {note.project && (
            <>
              <button
                className={viewMode === 'backlog' ? 'active' : ''}
                onClick={() => setViewMode('backlog')}
              >
                Backlog
              </button>
            </>
          )}
        </div>
        <div className="mobile-actions">
          <button
            className="save-btn"
            onClick={() =>
              updateMutation.mutate({
                content: buildContent(),
                title: currentTitle,
                hasBodyMetaChange,
              })
            }
            disabled={!hasChanges || updateMutation.isPending}
            title="Save"
          >
            <svg className="btn-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3.5 3.5L13 4"/></svg>
            <span className="btn-label">{updateMutation.isPending ? 'Saving...' : 'Save'}</span>
          </button>
          <button className="delete-btn" onClick={() => setShowDeleteModal(true)} title="Delete">
            <svg className="btn-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4h12"/><path d="M5.33 4V2.67a1.33 1.33 0 0 1 1.34-1.34h2.66a1.33 1.33 0 0 1 1.34 1.34V4"/><path d="M12.67 4v9.33a1.33 1.33 0 0 1-1.34 1.34H4.67a1.33 1.33 0 0 1-1.34-1.34V4"/></svg>
            <span className="btn-label">Delete</span>
          </button>
        </div>
      </div>
      
      <div className="editor-body">
        {viewMode === 'backlog' && note.project && (
          <Backlog noteId={noteId} />
        )}

        <div className={`editor-edit-pane ${viewMode !== 'edit' ? 'pane-hidden' : ''}`}>
          <div className="meta-bar editor-meta-block">
            <div className="meta-item">
              <label>Status</label>
              <select
                value={editedStatus}
                onChange={(e) => setEditedStatus(e.target.value)}
              >
                <option value="">(none)</option>
                <option value="building">building</option>
                <option value="done">done</option>
              </select>
            </div>
            <div className="meta-item tags">
              <label>Tags</label>
              {!isEditingTags ? (
                <div className="tags-view" onClick={() => setIsEditingTags(true)}>
                  {editedTags.length === 0 ? (
                    <span className="tag placeholder">add tags</span>
                  ) : (
                    editedTags.map((t) => (
                      <span key={t} className="tag">{t}</span>
                    ))
                  )}
                </div>
              ) : (
                <input
                  className="tags-input"
                  value={tagsInput}
                  autoFocus
                  onChange={(e) => setTagsInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      const next = tagsInput.split(' ').map((t) => t.trim()).filter(Boolean)
                      setEditedTags(next)
                      setIsEditingTags(false)
                    }
                  }}
                  onBlur={() => {
                    const next = tagsInput.split(' ').map((t) => t.trim()).filter(Boolean)
                    setEditedTags(next)
                    setIsEditingTags(false)
                  }}
                  placeholder="tags separated by spaces"
                />
              )}
            </div>
            {/* actions are in header */}
          </div>
          <textarea
            className={`editor-textarea ${editedContent !== null ? 'modified' : ''}`}
            value={currentBody}
            onChange={(e) => setEditedContent(e.target.value)}
          />
        </div>
        <div
          className={`editor-preview ${viewMode === 'preview' ? 'preview-only' : 'pane-hidden'}`}
        >
          <Markdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) => {
                if (href?.startsWith('/chaos/note/')) {
                  const noteId = href.replace('/chaos/note/', '')
                  return (
                    <a
                      href="#"
                      className="internal-link"
                      data-note-id={noteId}
                      onClick={(e) => {
                        e.preventDefault()
                        onNavigate(noteId)
                      }}
                    >
                      {children}
                    </a>
                  )
                }
                return <a href={href} target="_blank" rel="noopener">{children}</a>
              }
            }}
          >
            {processInternalLinks(previewBody)}
          </Markdown>
        </div>
      </div>
      
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Delete Note?</h2>
            <p>Are you sure you want to delete "{note.title}"?</p>
            <div className="modal-actions">
              <button onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button
                className="danger"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Main app
function MainApp() {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(() => {
    // Check URL for note ID on load
    const path = window.location.pathname
    const match = path.match(/\/chaos\/note\/([a-z0-9]{21})/)
    return match ? match[1] : null
  })
  
  const selectNote = (id: string | null) => {
    setSelectedNoteId(id)
    if (id) {
      window.history.pushState({}, '', `/chaos/note/${id}`)
    } else {
      window.history.pushState({}, '', '/chaos/')
    }
  }
  
  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname
      const match = path.match(/\/chaos\/note\/([a-z0-9]{21})/)
      setSelectedNoteId(match ? match[1] : null)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])
  
  return (
    <div className={`app ${selectedNoteId ? 'note-open' : ''}`}>
      <NoteList
        onSelectNote={selectNote}
        selectedId={selectedNoteId}
      />
      {selectedNoteId ? (
        <NoteEditor
          key={selectedNoteId}
          noteId={selectedNoteId}
          onClose={() => selectNote(null)}
          onNavigate={selectNote}
        />
      ) : (
        <div className="empty-state">
          <h2>🌀 Chaos Notes</h2>
          <p>Select a note or create a new one</p>
        </div>
      )}
    </div>
  )
}

// Root app with auth
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  
  useEffect(() => {
    api.checkAuth().then(setIsAuthenticated)
  }, [])
  
  if (isAuthenticated === null) {
    return <div className="loading-screen">Loading...</div>
  }
  
  if (!isAuthenticated) {
    return (
      <ToastProvider>
        <Login onLogin={() => setIsAuthenticated(true)} />
      </ToastProvider>
    )
  }
  
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  )
}
