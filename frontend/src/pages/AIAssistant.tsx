import React, { useState, useRef, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { useProject, fetchApi } from '../lib/api';
import { Send, Bot, User, Loader2, Info } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  intent?: string;
  sourceRefs?: string[];
}

export default function AIAssistant() {
  const { projectId } = useProject();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);
    setError(null);

    try {
      const res = await fetchApi<any>(`/projects/${projectId}/ai/chat`, {
        method: 'POST',
        body: JSON.stringify({ message: userMessage }),
      });
      
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.answer, intent: res.intent, sourceRefs: res.sourceRefs },
      ]);
    } catch (err: any) {
      setError(err.message || 'AI service is temporarily unavailable.');
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. ' + (err.message || 'AI service is temporarily unavailable.') },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col max-w-5xl mx-auto space-y-4">
      <div className="flex justify-between items-center px-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">AI Assistant</h2>
          <p className="text-sm font-medium text-slate-500 mt-1">Contextual intelligence for your cloud environment.</p>
        </div>
        <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full border border-indigo-100 text-xs font-bold">
          <Bot className="w-4 h-4" />
          <span>Gemini Copilot</span>
        </div>
      </div>

      <Card className="flex-1 flex flex-col min-h-0 bg-white shadow-sm border-slate-200">
        
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar bg-slate-50/50">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-5">
              <div className="w-16 h-16 bg-white border border-slate-200 rounded-2xl flex items-center justify-center shadow-sm">
                <Bot className="w-8 h-8 text-primary-600" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-slate-900">How can I help you analyze your cloud environment today?</h3>
                <p className="text-sm mt-1">Ask questions about security, attack paths, or financial estimates.</p>
              </div>
              <div className="flex flex-wrap justify-center gap-3 text-sm mt-6 max-w-2xl">
                <button className="px-4 py-2.5 bg-white border border-slate-200 shadow-sm rounded-lg hover:border-primary-300 hover:text-primary-700 font-medium transition-colors" onClick={() => setInput('What is my security posture?')}>What is my security posture?</button>
                <button className="px-4 py-2.5 bg-white border border-slate-200 shadow-sm rounded-lg hover:border-primary-300 hover:text-primary-700 font-medium transition-colors" onClick={() => setInput('Show me high risk attack paths.')}>Show me high risk attack paths.</button>
                <button className="px-4 py-2.5 bg-white border border-slate-200 shadow-sm rounded-lg hover:border-primary-300 hover:text-primary-700 font-medium transition-colors" onClick={() => setInput('What is driving current AWS cost?')}>What is driving current AWS cost?</button>
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex max-w-[85%] rounded-2xl p-5 shadow-sm ${msg.role === 'user' ? 'bg-primary-600 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'}`}>
                <div className="mr-4 shrink-0 mt-0.5">
                  {msg.role === 'user' ? (
                    <div className="w-8 h-8 bg-primary-700 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center">
                      <Bot className="w-5 h-5 text-indigo-600" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="whitespace-pre-wrap leading-relaxed text-[15px] prose prose-slate prose-sm max-w-none">
                    {msg.content}
                  </div>
                  {msg.sourceRefs && msg.sourceRefs.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-2 items-center">
                      <Info className="w-4 h-4 text-slate-400" />
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sources:</span>
                      {msg.sourceRefs.map((ref) => (
                        <span key={ref} className="text-xs font-medium px-2 py-1 bg-slate-100 border border-slate-200 rounded-md text-slate-600">{ref}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center space-x-3 bg-white border border-slate-200 text-slate-700 rounded-2xl rounded-tl-sm p-4 shadow-sm">
                <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
                <span className="text-sm font-medium">Analyzing your context...</span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="p-4 md:p-6 bg-white border-t border-slate-200 rounded-b-xl">
          <form onSubmit={handleSubmit} className="relative">
            <input
              type="text"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-5 pr-14 py-4 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm transition-shadow"
              placeholder="Ask the AI Cloud Assistant..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="absolute right-2 top-2 bottom-2 aspect-square flex items-center justify-center bg-primary-600 hover:bg-primary-700 rounded-lg text-white disabled:opacity-50 transition-colors shadow-sm"
            >
              <Send className="w-5 h-5 ml-1" />
            </button>
          </form>
          {error && <p className="mt-3 text-sm font-medium text-red-500 px-1">{error}</p>}
        </div>
      </Card>
    </div>
  );
}
