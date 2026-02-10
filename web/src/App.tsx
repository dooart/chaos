import { useState, useEffect, createContext, useContext, useCallback } from 'react'
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
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview')
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

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
    }
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
            >
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </button>
            <button className="delete-btn" onClick={() => setShowDeleteModal(true)}>
              Delete
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
          >
            {updateMutation.isPending ? 'Saving...' : 'Save'}
          </button>
          <button className="delete-btn" onClick={() => setShowDeleteModal(true)}>
            Delete
          </button>
        </div>
      </div>
      
      <div className="editor-body">
        <div className={`editor-edit-pane ${viewMode === 'preview' ? 'pane-hidden' : ''}`}>
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
          className={`editor-preview ${viewMode === 'preview' ? 'preview-only' : (isMobile ? 'pane-hidden' : '')}`}
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
