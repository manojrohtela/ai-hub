import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Sparkles, Info, MessageCircle, X, ChevronDown, Shield } from 'lucide-react';
import { getAlternatives, postIntent, searchMedicines } from './lib/api';
import type {
  AlternativesResponse,
  IntentResponse,
  MedicineRecord,
  SearchResponse,
} from './lib/types';

type Screen = 'hero' | 'results';
type ChatRole = 'assistant' | 'user';
type ChatTone = 'default' | 'warning';

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  items?: string[];
  actions?: string[];
  tone?: ChatTone;
}

interface LookupBundle {
  inputText: string;
  intent: IntentResponse;
  search: SearchResponse | null;
  alternatives: AlternativesResponse | null;
}

const quickSuggestions = ['Headache relief', 'Fever medicine', 'Paracetamol alternatives'];

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatUses(uses: string[], limit = 3): string {
  if (!uses.length) {
    return 'Uses were not available in the dataset.';
  }

  return uses.slice(0, limit).join(', ');
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong while contacting the backend.';
}

function mergeMedicineRecords(
  existing: MedicineRecord | undefined,
  incoming: MedicineRecord,
): MedicineRecord {
  if (!existing) {
    return incoming;
  }

  return {
    ...incoming,
    match_tags: Array.from(new Set([...(existing.match_tags ?? []), ...(incoming.match_tags ?? [])])),
    match_reason: incoming.match_reason ?? existing.match_reason,
    score: Math.max(existing.score ?? 0, incoming.score ?? 0),
  };
}

function buildMedicineCollection(
  result: SearchResponse | null,
  alternatives: AlternativesResponse | null,
): MedicineRecord[] {
  const merged = new Map<string, MedicineRecord>();
  const primary = result?.primary_result ?? null;
  const medicines = [
    ...(primary ? [primary] : []),
    ...(result?.medicines ?? []),
    ...(alternatives?.medicines ?? []),
  ];

  medicines.forEach((medicine) => {
    const key = medicine.name.toLowerCase();
    merged.set(key, mergeMedicineRecords(merged.get(key), medicine));
  });

  return Array.from(merged.values()).sort(
    (left, right) => (right.score ?? 0) - (left.score ?? 0) || left.name.localeCompare(right.name),
  );
}

function getFilterOptions(result: SearchResponse | null, medicines: MedicineRecord[]): string[] {
  if (!result || !medicines.length) {
    return ['All'];
  }

  if (result.entity_type === 'medicine') {
    return ['All', 'Exact Match', 'Same Salt', 'Same Category'];
  }

  return ['All', 'Top Matches', 'Category Match', 'Use Match'];
}

function filterMedicines(medicines: MedicineRecord[], activeFilter: string): MedicineRecord[] {
  if (activeFilter === 'All') {
    return medicines;
  }

  if (activeFilter === 'Exact Match') {
    return medicines.filter((medicine) => medicine.match_tags.includes('exact_match'));
  }

  if (activeFilter === 'Same Salt') {
    return medicines.filter((medicine) => medicine.match_tags.includes('same_salt'));
  }

  if (activeFilter === 'Same Category' || activeFilter === 'Category Match') {
    return medicines.filter((medicine) =>
      medicine.match_tags.includes('same_category') || medicine.match_tags.includes('category_match'),
    );
  }

  if (activeFilter === 'Use Match') {
    return medicines.filter((medicine) => medicine.match_tags.includes('uses_match'));
  }

  if (activeFilter === 'Top Matches') {
    return medicines.slice(0, 6);
  }

  return medicines;
}

function getBadgeLabel(medicine: MedicineRecord): string {
  if (medicine.match_tags.includes('exact_match')) {
    return 'Exact Match';
  }
  if (medicine.match_tags.includes('same_salt')) {
    return 'Same Salt';
  }
  if (medicine.match_tags.includes('same_category') || medicine.match_tags.includes('category_match')) {
    return 'Category Match';
  }
  if (medicine.match_tags.includes('uses_match')) {
    return 'Use Match';
  }
  if (medicine.match_tags.includes('composition_match')) {
    return 'Composition Match';
  }

  return 'Related Result';
}

function buildResultTitle(result: SearchResponse | null, lastSearchText: string): string {
  if (!result) {
    return lastSearchText || 'Search Results';
  }

  if (result.entity_type === 'medicine') {
    return result.primary_result?.name ?? result.matched_text ?? lastSearchText;
  }

  return lastSearchText || result.query;
}

function buildResultSubtitle(
  result: SearchResponse | null,
  alternatives: AlternativesResponse | null,
): string {
  if (!result) {
    return 'Search the dataset for medicines or symptoms.';
  }

  if (result.entity_type === 'medicine' && result.primary_result) {
    const alternativesText = alternatives?.count
      ? ` | ${alternatives.count} same-salt alternatives found`
      : '';
    return `${result.primary_result.composition}${alternativesText}`;
  }

  const categoryText = result.categories.length
    ? `Matched categories: ${result.categories.join(', ')}`
    : 'Matched against medicine uses and categories in the dataset.';

  return categoryText;
}

function buildInsightText(
  result: SearchResponse | null,
  alternatives: AlternativesResponse | null,
  intent: IntentResponse | null,
): string {
  if (!result) {
    return 'Use the search box to look up a medicine or a symptom from the dataset.';
  }

  if (intent?.requested_action === 'unsupported_medical_advice') {
    return "This dataset can show medicine details and alternatives, but it doesn't support side effects, dosage, or safety guidance.";
  }

  if (result.entity_type === 'medicine' && result.primary_result) {
    const alternativesText = alternatives?.count
      ? ` I also found ${alternatives.count} alternatives with the same salt key.`
      : '';
    return `${result.summary}${alternativesText}`;
  }

  return result.summary;
}

function buildWhyText(
  result: SearchResponse | null,
  lastSearchText: string,
): string {
  if (!result) {
    return 'Results are generated from the loaded CSV dataset and matched against medicine names, uses, categories, and salt keys.';
  }

  if (result.entity_type === 'medicine' && result.primary_result) {
    return `The result matched "${lastSearchText}" to ${result.primary_result.name} using medicine name, composition, or salt-key similarity in the dataset.`;
  }

  if (result.categories.length) {
    return `The query "${lastSearchText}" matched medicines whose uses and categories overlap with ${result.categories.join(', ')}.`;
  }

  return `The query "${lastSearchText}" was checked against medicine names, uses, categories, and salt keys in the dataset.`;
}

function buildNoResultActions(intent: IntentResponse | null): string[] {
  return intent?.follow_up_questions?.length
    ? intent.follow_up_questions
    : ['Paracetamol alternatives', 'Headache relief', 'Fever medicine'];
}

function buildAssistantResponse(
  lookup: LookupBundle,
): ChatMessage {
  const { intent, search, alternatives } = lookup;
  const primary = search?.primary_result ?? null;

  if (!search || !primary) {
    return {
      id: makeId(),
      role: 'assistant',
      tone: 'warning',
      text: "I couldn't find a strong dataset match for that query.",
      items: ['Try a medicine brand name, salt name, or a common symptom like fever or headache.'],
      actions: buildNoResultActions(intent),
    };
  }

  if (intent.requested_action === 'unsupported_medical_advice') {
    return {
      id: makeId(),
      role: 'assistant',
      tone: 'warning',
      text: `I can't answer side effects, dosage, or safety advice for ${primary.name} from this dataset, but I can show its dataset-backed details and alternatives.`,
      items: [
        `Category: ${primary.category}`,
        `Uses: ${formatUses(primary.uses)}`,
        `Same-salt alternatives: ${alternatives?.count ?? 0}`,
      ],
      actions: search.follow_up_questions,
    };
  }

  if (search.entity_type === 'medicine') {
    return {
      id: makeId(),
      role: 'assistant',
      text: `${primary.name} is listed under ${primary.category} and is commonly used for ${formatUses(primary.uses, 2)}.`,
      items: [
        `Composition: ${primary.composition}`,
        `Manufacturer: ${primary.manufacturer}`,
        `Same-salt alternatives: ${alternatives?.count ?? 0}`,
      ],
      actions: search.follow_up_questions,
    };
  }

  return {
    id: makeId(),
    role: 'assistant',
    text: `I found ${search.medicines.length} medicines related to ${search.matched_text ?? lookup.inputText}.`,
    items: search.medicines.slice(0, 3).map((medicine) => `${medicine.name} - ${medicine.category}`),
    actions: search.follow_up_questions,
  };
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('hero');
  const [query, setQuery] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [expandedInsight, setExpandedInsight] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null);
  const [alternatives, setAlternatives] = useState<AlternativesResponse | null>(null);
  const [lastIntent, setLastIntent] = useState<IntentResponse | null>(null);
  const [lastSearchText, setLastSearchText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: makeId(),
      role: 'assistant',
      text: "I can search the medicine dataset and show alternatives. I can't provide dosage, side effects, or treatment advice.",
      items: ['Try a medicine name like Paracetamol or a symptom like headache or fever.'],
      actions: quickSuggestions,
    },
  ]);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const medicines = buildMedicineCollection(searchResult, alternatives);
  const filters = getFilterOptions(searchResult, medicines);
  const filteredMedicines = filterMedicines(medicines, activeFilter);
  const visibleMedicines = filteredMedicines.length ? filteredMedicines : medicines;

  useEffect(() => {
    setActiveFilter('All');
    setExpandedInsight(false);
  }, [searchResult?.query, alternatives?.salt_key]);

  useEffect(() => {
    if (chatOpen) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, chatLoading, chatOpen]);

  const applyLookup = (lookup: LookupBundle) => {
    setLastSearchText(lookup.inputText);
    setLastIntent(lookup.intent);
    setSearchResult(lookup.search);
    setAlternatives(lookup.alternatives);
    setScreen('results');
    setSearchError(null);
  };

  const performLookup = async (inputText: string): Promise<LookupBundle> => {
    const intent = await postIntent(inputText);
    const searchText = intent.entity_value?.trim() || inputText;
    const search = await searchMedicines(
      searchText,
      intent.entity_type === 'unknown' ? undefined : intent.entity_type,
    );

    let alternativesResponse: AlternativesResponse | null = null;
    const saltKey = search.primary_result?.salt_key;

    if (
      saltKey &&
      (intent.entity_type === 'medicine' || intent.requested_action === 'alternatives')
    ) {
      alternativesResponse = await getAlternatives(saltKey, search.primary_result?.name ?? undefined);
    }

    return {
      inputText,
      intent,
      search,
      alternatives: alternativesResponse,
    };
  };

  const runSearch = async (inputText: string) => {
    if (!inputText.trim()) {
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setScreen('results');

    try {
      const lookup = await performLookup(inputText.trim());
      applyLookup(lookup);
    } catch (error) {
      setLastSearchText(inputText.trim());
      setSearchResult(null);
      setAlternatives(null);
      setLastIntent(null);
      setSearchError(getErrorMessage(error));
    } finally {
      setIsSearching(false);
    }
  };

  const sendChatMessage = async (inputText: string) => {
    const trimmed = inputText.trim();
    if (!trimmed || chatLoading) {
      return;
    }

    setChatMessages((current) => [
      ...current,
      {
        id: makeId(),
        role: 'user',
        text: trimmed,
      },
    ]);
    setChatLoading(true);

    try {
      const lookup = await performLookup(trimmed);
      applyLookup(lookup);
      setChatMessages((current) => [...current, buildAssistantResponse(lookup)]);
    } catch (error) {
      setChatMessages((current) => [
        ...current,
        {
          id: makeId(),
          role: 'assistant',
          tone: 'warning',
          text: `I couldn't reach the backend right now. ${getErrorMessage(error)}`,
          actions: quickSuggestions,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await runSearch(query);
  };

  const handleSuggestionClick = async (suggestion: string) => {
    setQuery(suggestion);
    await runSearch(suggestion);
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentInput = chatInput;
    setChatInput('');
    await sendChatMessage(currentInput);
  };

  const handleViewUses = async (medicineName: string) => {
    setChatOpen(true);
    await sendChatMessage(`What is ${medicineName} used for?`);
  };

  const handleOpenDetails = async (medicineName: string) => {
    setQuery(medicineName);
    await runSearch(medicineName);
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden dark">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a1a] via-[#1a1a2e] to-[#0f0f1e]" />

      {/* Animated background blobs */}
      <motion.div
        className="absolute top-20 left-20 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      <motion.div
        className="absolute bottom-20 right-20 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl"
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.5, 0.3, 0.5],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      {/* Hero Screen */}
      <AnimatePresence>
        {screen === 'hero' && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center px-8"
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              className="w-full max-w-2xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {/* Logo and Title */}
              <motion.div
                className="text-center mb-12"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <motion.div
                  className="inline-flex items-center gap-3 mb-4"
                  animate={{
                    scale: [1, 1.05, 1],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <Sparkles className="w-8 h-8 text-purple-400" />
                  <h1 className="text-5xl tracking-tight bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                    MedAssist AI
                  </h1>
                </motion.div>
                <p className="text-gray-400 text-lg">
                  Ask about symptoms or medicines
                </p>
              </motion.div>

              {/* Glowing Input */}
              <motion.form
                onSubmit={handleSearch}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <motion.div
                  className="relative"
                  animate={{
                    boxShadow: [
                      '0 0 20px rgba(147, 51, 234, 0.3)',
                      '0 0 40px rgba(147, 51, 234, 0.5)',
                      '0 0 20px rgba(147, 51, 234, 0.3)',
                    ]
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  style={{
                    borderRadius: '16px',
                  }}
                >
                  {/* Glassmorphism container */}
                  <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-1">
                    <div className="flex items-center gap-4 px-6 py-5">
                      <Search className="w-6 h-6 text-purple-400 flex-shrink-0" />
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search for medicines or describe your symptoms..."
                        className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-gray-500 text-lg"
                        autoFocus
                      />
                    </div>
                  </div>
                </motion.div>
              </motion.form>

              {/* Quick suggestions */}
              <motion.div
                className="mt-8 flex flex-wrap gap-3 justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                {quickSuggestions.map((suggestion, i) => (
                  <motion.button
                    key={suggestion}
                    onClick={() => void handleSuggestionClick(suggestion)}
                    className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white hover:border-purple-500/50 transition-all"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 + i * 0.1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {suggestion}
                  </motion.button>
                ))}
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Screen */}
      <AnimatePresence>
        {screen === 'results' && (
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {/* Warning Bar */}
            <motion.div
              className="sticky top-0 z-40 backdrop-blur-xl bg-amber-500/10 border-b border-amber-500/20 px-6 py-3"
              initial={{ y: -100 }}
              animate={{ y: 0 }}
              transition={{ type: "spring", damping: 20 }}
            >
              <div className="flex items-center justify-center gap-2 text-amber-400">
                <Shield className="w-4 h-4" />
                <span className="text-sm">⚠ Consult a doctor before taking any medicine</span>
              </div>
            </motion.div>

            {/* Main Content */}
            <div className="h-[calc(100vh-60px)] overflow-y-auto px-8 py-8">
              <div className="max-w-7xl mx-auto">
                {/* Query Display */}
                <motion.div
                  className="mb-8"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <h2 className="text-4xl mb-2 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                    {isSearching ? 'Searching...' : buildResultTitle(searchResult, lastSearchText)}
                  </h2>
                  <p className="text-gray-500">
                    {searchError
                      ? searchError
                      : buildResultSubtitle(searchResult, alternatives)}
                  </p>
                </motion.div>

                {/* Insight Card */}
                <motion.div
                  className="mb-8 relative"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <motion.div
                    className="backdrop-blur-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-3xl p-6 shadow-2xl"
                    whileHover={{ scale: 1.02, rotateX: 2 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-purple-500/20 rounded-2xl">
                        <Sparkles className="w-6 h-6 text-purple-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl mb-2 text-white">Key Insight</h3>
                        <p className="text-gray-300 leading-relaxed">
                          {isSearching
                            ? 'Searching the dataset and preparing medicine matches for your query...'
                            : buildInsightText(searchResult, alternatives, lastIntent)}
                        </p>

                        {!isSearching && (
                          <button
                            onClick={() => setExpandedInsight(!expandedInsight)}
                            className="mt-4 flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors"
                          >
                            <span>Why this?</span>
                            <motion.div
                              animate={{ rotate: expandedInsight ? 180 : 0 }}
                              transition={{ duration: 0.3 }}
                            >
                              <ChevronDown className="w-4 h-4" />
                            </motion.div>
                          </button>
                        )}

                        <AnimatePresence>
                          {expandedInsight && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-4 pt-4 border-t border-purple-500/20 text-gray-400">
                                {buildWhyText(searchResult, lastSearchText)}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>

                {/* Filters */}
                <motion.div
                  className="mb-6 flex gap-3 flex-wrap"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  {filters.map((filter, i) => (
                    <motion.button
                      key={filter}
                      onClick={() => setActiveFilter(filter)}
                      className={`px-5 py-2 rounded-full backdrop-blur-xl transition-all ${
                        activeFilter === filter
                          ? 'bg-purple-500/30 border-purple-500/50 text-white shadow-lg shadow-purple-500/20'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                      } border`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + i * 0.05 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {filter}
                    </motion.button>
                  ))}
                </motion.div>

                {/* Medicine Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-24">
                  {!visibleMedicines.length && !isSearching && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="md:col-span-2 lg:col-span-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 text-center"
                    >
                      <h4 className="text-xl text-white mb-2">No medicine cards to show yet</h4>
                      <p className="text-gray-400">
                        Try a medicine name like Paracetamol or a symptom like headache, fever, or acidity.
                      </p>
                    </motion.div>
                  )}

                  {visibleMedicines.map((med, i) => (
                    <motion.div
                      key={med.name}
                      initial={{ opacity: 0, y: 30, rotateX: -10 }}
                      animate={{ opacity: 1, y: 0, rotateX: 0 }}
                      transition={{ delay: 0.5 + i * 0.1 }}
                      whileHover={{
                        scale: 1.05,
                        rotateY: 5,
                        z: 50,
                        transition: { type: "spring", stiffness: 300 }
                      }}
                      className="relative group"
                    >
                      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 hover:bg-white/10 hover:border-purple-500/30 transition-all shadow-xl hover:shadow-purple-500/20">
                        <div className="absolute top-4 right-4">
                          <span className="px-3 py-1 bg-green-500/20 border border-green-500/30 text-green-400 rounded-full text-xs">
                            {getBadgeLabel(med)}
                          </span>
                        </div>

                        <h4 className="text-xl mb-2 text-white pr-24">{med.name}</h4>
                        <p className="text-gray-400 text-sm mb-2">{med.manufacturer}</p>
                        <p className="text-gray-500 text-xs mb-4 line-clamp-2">{med.composition}</p>

                        <div className="flex items-center justify-between mb-4">
                          <span className="text-2xl text-purple-400">{titleCase(med.salt_key)}</span>
                        </div>

                        <p className="text-sm text-gray-300 mb-4 min-h-10">
                          {formatUses(med.uses, 2)}
                        </p>

                        <div className="flex gap-2">
                          <motion.button
                            onClick={() => void handleViewUses(med.name)}
                            className="flex-1 px-4 py-2 bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded-xl hover:bg-purple-500/30 transition-all"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            View Uses
                          </motion.button>
                          <motion.button
                            onClick={() => void handleOpenDetails(med.name)}
                            className="px-4 py-2 bg-white/5 border border-white/10 text-gray-300 rounded-xl hover:bg-white/10 transition-all"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Info className="w-5 h-5" />
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Input (when in results) */}
      <AnimatePresence>
        {screen === 'results' && !chatOpen && (
          <motion.div
            className="fixed bottom-6 right-6 z-50"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.8, type: "spring", stiffness: 200 }}
          >
            <motion.button
              onClick={() => setChatOpen(true)}
              className="p-4 backdrop-blur-xl bg-gradient-to-br from-purple-500/80 to-blue-500/80 rounded-2xl shadow-2xl border border-white/20"
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.9 }}
              animate={{
                boxShadow: [
                  '0 0 20px rgba(147, 51, 234, 0.5)',
                  '0 0 40px rgba(147, 51, 234, 0.8)',
                  '0 0 20px rgba(147, 51, 234, 0.5)',
                ]
              }}
              transition={{
                boxShadow: {
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }
              }}
            >
              <MessageCircle className="w-6 h-6 text-white" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {chatOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setChatOpen(false)}
            />

            {/* Chat Container */}
            <motion.div
              className="fixed bottom-6 right-6 w-96 h-[600px] z-50"
              initial={{ scale: 0, opacity: 0, x: 100, y: 100 }}
              animate={{ scale: 1, opacity: 1, x: 0, y: 0 }}
              exit={{ scale: 0, opacity: 0, x: 100, y: 100 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              <div className="h-full backdrop-blur-2xl bg-gradient-to-br from-gray-900/95 to-gray-800/95 border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
                {/* Chat Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/20 rounded-xl">
                      <MessageCircle className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-white">MedAssist Chat</h3>
                      <p className="text-xs text-gray-400">Ask me anything</p>
                    </div>
                  </div>
                  <motion.button
                    onClick={() => setChatOpen(false)}
                    className="p-2 hover:bg-white/10 rounded-xl transition-all"
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </motion.button>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 p-6 space-y-4 overflow-y-auto">
                  {chatMessages.map((message, index) => (
                    <motion.div
                      key={message.id}
                      className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      {message.role === 'assistant' && (
                        <div className="p-2 bg-purple-500/20 rounded-xl h-fit">
                          <Sparkles className="w-4 h-4 text-purple-400" />
                        </div>
                      )}

                      <div
                        className={
                          message.role === 'user'
                            ? 'bg-gradient-to-br from-purple-500/30 to-blue-500/30 border border-purple-500/30 rounded-2xl rounded-tr-none p-4 max-w-[85%]'
                            : `flex-1 border rounded-2xl rounded-tl-none p-4 ${
                                message.tone === 'warning'
                                  ? 'bg-amber-500/10 border-amber-500/20'
                                  : 'bg-white/5 border-white/10'
                              }`
                        }
                      >
                        <p className={message.role === 'user' ? 'text-white text-sm' : 'text-gray-300 text-sm'}>
                          {message.text}
                        </p>

                        {!!message.items?.length && (
                          <div className="space-y-2 mt-3">
                            {message.items.map((item) => (
                              <div
                                key={`${message.id}-${item}`}
                                className="px-3 py-2 bg-white/5 rounded-xl text-sm text-gray-300"
                              >
                                {item}
                              </div>
                            ))}
                          </div>
                        )}

                        {!!message.actions?.length && message.role === 'assistant' && (
                          <div className="mt-3 flex gap-2 flex-wrap">
                            {message.actions.map((action) => (
                              <motion.button
                                key={`${message.id}-${action}`}
                                onClick={() => void sendChatMessage(action)}
                                className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded-lg text-xs"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                {action}
                              </motion.button>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}

                  {/* Typing Indicator */}
                  {chatLoading && (
                    <motion.div
                      className="flex gap-3"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="p-2 bg-purple-500/20 rounded-xl h-fit">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-none px-4 py-3">
                        <div className="flex gap-1">
                          <motion.div
                            className="w-2 h-2 bg-purple-400 rounded-full"
                            animate={{ y: [0, -5, 0] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                          />
                          <motion.div
                            className="w-2 h-2 bg-purple-400 rounded-full"
                            animate={{ y: [0, -5, 0] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                          />
                          <motion.div
                            className="w-2 h-2 bg-purple-400 rounded-full"
                            animate={{ y: [0, -5, 0] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Chat Input */}
                <div className="p-4 border-t border-white/10">
                  <form className="flex gap-2" onSubmit={handleChatSubmit}>
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask a question..."
                      className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 outline-none focus:border-purple-500/50 transition-all"
                    />
                    <motion.button
                      type="submit"
                      className="px-4 py-3 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl text-white"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Search className="w-5 h-5" />
                    </motion.button>
                  </form>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
