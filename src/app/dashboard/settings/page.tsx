'use client';

import { useState, useCallback, useEffect } from 'react';
import { useStore } from '@/lib/store-context';
import {
  useStoreSettings,
  SETTINGS_SECTIONS,
  SETTINGS_DEFAULTS,
  type StoreSettings,
} from '@/lib/store-settings';

export default function SettingsPage() {
  const { can, store } = useStore();
  const currentSettings = useStoreSettings();
  const [settings, setSettings] = useState<StoreSettings>(currentSettings);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Sync when store context loads
  useEffect(() => {
    setSettings(currentSettings);
  }, [currentSettings]);

  if (!can('store.settings')) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-zinc-500">You don&apos;t have permission to view settings.</p>
      </div>
    );
  }

  // Auto-save a single field
  const saveField = useCallback(
    async (key: string, value: unknown) => {
      setSaving(key);
      setError('');
      try {
        const res = await fetch('/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [key]: value }),
        });
        if (!res.ok) throw new Error('Failed to save');
        setSaved(key);
        setTimeout(() => setSaved(null), 1500);
      } catch {
        setError(`Failed to save ${key}`);
      } finally {
        setSaving(null);
      }
    },
    []
  );

  // Reset a section to defaults
  async function resetSection(sectionKey: string) {
    const section = SETTINGS_SECTIONS.find((s) => s.key === sectionKey);
    if (!section) return;

    const resetValues: Partial<StoreSettings> = {};
    for (const field of section.fields) {
      const defaultVal = SETTINGS_DEFAULTS[field.key as keyof StoreSettings];
      (resetValues as Record<string, unknown>)[field.key] = defaultVal;
      (setSettings as (fn: (prev: StoreSettings) => StoreSettings) => void)((prev) => ({
        ...prev,
        [field.key]: defaultVal,
      }));
    }

    setSaving(sectionKey);
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resetValues),
      });
      setSaved(sectionKey);
      setTimeout(() => setSaved(null), 1500);
    } catch {
      setError('Failed to reset section');
    } finally {
      setSaving(null);
    }
  }

  function updateLocal(key: string, value: unknown) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Store Settings</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {store?.name} &middot; Changes save automatically
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="max-w-2xl space-y-4">
        {SETTINGS_SECTIONS.map((section) => (
          <div
            key={section.key}
            className="rounded-lg border border-zinc-800 bg-zinc-900 p-6"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">{section.label}</h2>
                <p className="mt-0.5 text-xs text-zinc-500">{section.description}</p>
              </div>
              <button
                onClick={() => resetSection(section.key)}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {saving === section.key ? 'Resetting...' : saved === section.key ? 'Reset!' : 'Reset to defaults'}
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {section.fields.map((field) => {
                const key = field.key as keyof StoreSettings;
                const value = settings[key];
                const isSaving = saving === field.key;
                const isSaved = saved === field.key;

                if (field.type === 'text') {
                  return (
                    <div key={field.key}>
                      <label className="mb-1 block text-xs text-zinc-400">{field.label}</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={String(value ?? '')}
                          placeholder={'placeholder' in field ? (field as { placeholder?: string }).placeholder : ''}
                          onChange={(e) => updateLocal(field.key, e.target.value)}
                          onBlur={(e) => saveField(field.key, e.target.value)}
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
                        />
                        {isSaving && <span className="absolute right-3 top-2.5 text-xs text-zinc-500">Saving...</span>}
                        {isSaved && <span className="absolute right-3 top-2.5 text-xs text-green-400">Saved</span>}
                      </div>
                    </div>
                  );
                }

                if (field.type === 'number') {
                  return (
                    <div key={field.key}>
                      <label className="mb-1 block text-xs text-zinc-400">{field.label}</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={Number(value ?? 0)}
                          min={'min' in field ? (field as { min?: number }).min : undefined}
                          max={'max' in field ? (field as { max?: number }).max : undefined}
                          step={'step' in field ? (field as { step?: number }).step : undefined}
                          onChange={(e) => updateLocal(field.key, Number(e.target.value))}
                          onBlur={(e) => saveField(field.key, Number(e.target.value))}
                          className="w-48 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white tabular-nums focus:border-indigo-500 focus:outline-none"
                        />
                        {isSaving && <span className="ml-3 text-xs text-zinc-500">Saving...</span>}
                        {isSaved && <span className="ml-3 text-xs text-green-400">Saved</span>}
                      </div>
                    </div>
                  );
                }

                if (field.type === 'toggle') {
                  return (
                    <div key={field.key} className="flex items-center justify-between">
                      <label className="text-sm text-zinc-300">{field.label}</label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const newVal = !value;
                            updateLocal(field.key, newVal);
                            saveField(field.key, newVal);
                          }}
                          className={`relative h-6 w-11 rounded-full transition-colors ${
                            value ? 'bg-indigo-600' : 'bg-zinc-700'
                          }`}
                        >
                          <span
                            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                              value ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        {isSaved && <span className="text-xs text-green-400">Saved</span>}
                      </div>
                    </div>
                  );
                }

                if (field.type === 'select' && 'options' in field) {
                  return (
                    <div key={field.key}>
                      <label className="mb-1 block text-xs text-zinc-400">{field.label}</label>
                      <select
                        value={String(value ?? '')}
                        onChange={(e) => {
                          updateLocal(field.key, e.target.value);
                          saveField(field.key, e.target.value);
                        }}
                        className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                      >
                        {(field as { options: Array<{ value: string; label: string }> }).options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {isSaved && <span className="ml-3 text-xs text-green-400">Saved</span>}
                    </div>
                  );
                }

                if (field.type === 'multiselect' && 'options' in field) {
                  const selected = Array.isArray(value) ? value as string[] : [];
                  return (
                    <div key={field.key}>
                      <label className="mb-2 block text-xs text-zinc-400">{field.label}</label>
                      <div className="flex flex-wrap gap-2">
                        {(field as { options: Array<{ value: string; label: string }> }).options.map((opt) => {
                          const isOn = selected.includes(opt.value);
                          return (
                            <button
                              key={opt.value}
                              onClick={() => {
                                const newVal = isOn
                                  ? selected.filter((v) => v !== opt.value)
                                  : [...selected, opt.value];
                                updateLocal(field.key, newVal);
                                saveField(field.key, newVal);
                              }}
                              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                                isOn
                                  ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                                  : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                      {isSaved && <span className="mt-1 block text-xs text-green-400">Saved</span>}
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
