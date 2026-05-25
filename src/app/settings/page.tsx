'use client';

import { useState, useCallback } from 'react';
import {
  Palette,
  Zap,
  Globe,
  Shield,
  HardDrive,
  Moon,
  Sun,
  Sparkles,
} from 'lucide-react';
import TopBar from '@/components/layout/TopBar';
import { Badge } from '@/components/ui/Badge';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useSettings } from '@/hooks/useSettings';

type ThemeMode = 'dark' | 'amoled' | 'neon';

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: () => void;
}

function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <div className="flex items-center justify-between min-h-[48px]">
      <span className="text-white text-sm font-medium">{label}</span>
      <button
        onClick={onChange}
        className={`relative w-12 h-6 rounded-full transition-colors duration-150 ${
          checked ? 'bg-grovix-purple' : 'bg-grovix-border'
        }`}
        role="switch"
        aria-checked={checked}
        aria-label={`Toggle ${label}`}
        type="button"
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-150 ${
            checked ? 'translate-x-6' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

interface PillSelectorProps {
  options: string[];
  selected: string;
  onChange: (value: string) => void;
}

function PillSelector({ options, selected, onChange }: PillSelectorProps) {
  return (
    <div className="flex gap-2">
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={`min-h-[40px] px-4 rounded-xl text-xs font-medium transition-colors duration-150 ${
            selected === option
              ? 'bg-grovix-purple text-white'
              : 'bg-grovix-secondary text-grovix-muted border border-grovix-border hover:text-white'
          }`}
          type="button"
          aria-pressed={selected === option}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

const themes: { id: ThemeMode; label: string; icon: React.ReactNode; description: string }[] = [
  {
    id: 'dark',
    label: 'Dark',
    icon: <Moon className="w-5 h-5" />,
    description: 'Classic dark theme',
  },
  {
    id: 'amoled',
    label: 'AMOLED',
    icon: <Sun className="w-5 h-5" />,
    description: 'Pure black for OLED',
  },
  {
    id: 'neon',
    label: 'Neon',
    icon: <Sparkles className="w-5 h-5" />,
    description: 'Vibrant neon colors',
  },
];

export default function SettingsPage() {
  const { settings, updateSetting, resetSettings } = useSettings();

  const [clearCacheModal, setClearCacheModal] = useState(false);
  const [optimizeModal, setOptimizeModal] = useState(false);
  const [resetModal, setResetModal] = useState(false);

  const handleClearCache = useCallback(() => {
    try {
      localStorage.removeItem('grovix_cache');
    } catch {
      // ignore
    }
    setClearCacheModal(false);
  }, []);

  const handleOptimize = useCallback(() => {
    setOptimizeModal(false);
  }, []);

  const handleReset = useCallback(() => {
    resetSettings();
    setResetModal(false);
  }, [resetSettings]);

  const storageUsed = 1.2;
  const storageTotal = 4;
  const storagePercent = (storageUsed / storageTotal) * 100;

  return (
    <div className="min-h-screen bg-grovix-bg pb-24">
      <TopBar title="Settings" showBack />

      <div className="px-4 pt-4 space-y-6">
        {/* Appearance Section */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Palette className="w-4 h-4 text-grovix-purple" />
            <h2 className="text-white font-semibold text-base">Appearance</h2>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {themes.map((theme) => {
              const isSelected = settings.theme === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => updateSetting('theme', theme.id)}
                  className={`rounded-2xl p-3 flex flex-col items-center gap-2 transition-colors duration-150 ${
                    isSelected
                      ? 'border border-grovix-purple bg-grovix-purple/10'
                      : 'border border-grovix-border bg-grovix-card hover:border-grovix-purple/50'
                  }`}
                  type="button"
                  aria-pressed={isSelected}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isSelected
                        ? 'bg-grovix-purple/20 text-grovix-purple'
                        : 'bg-grovix-secondary text-grovix-muted'
                    }`}
                  >
                    {theme.icon}
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      isSelected ? 'text-grovix-purple' : 'text-white'
                    }`}
                  >
                    {theme.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Performance Section */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-grovix-purple" />
            <h2 className="text-white font-semibold text-base">Performance</h2>
          </div>
          <div className="bg-grovix-card border border-grovix-border rounded-2xl p-4 space-y-1">
            <Toggle
              label="Smooth Mode"
              checked={settings.smoothMode}
              onChange={() => updateSetting('smoothMode', !settings.smoothMode)}
            />
            <Toggle
              label="Battery Saver"
              checked={settings.batterySaver}
              onChange={() =>
                updateSetting('batterySaver', !settings.batterySaver)
              }
            />
            <Toggle
              label="Lite Animation"
              checked={settings.liteAnimation}
              onChange={() =>
                updateSetting('liteAnimation', !settings.liteAnimation)
              }
            />
            <Toggle
              label="Performance Boost"
              checked={settings.performanceBoost}
              onChange={() =>
                updateSetting('performanceBoost', !settings.performanceBoost)
              }
            />
          </div>
        </section>

        {/* Network Section */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-grovix-purple" />
            <h2 className="text-white font-semibold text-base">Network</h2>
          </div>
          <div className="bg-grovix-card border border-grovix-border rounded-2xl p-4 space-y-1">
            <Toggle
              label="Low Data Mode"
              checked={settings.lowDataMode}
              onChange={() =>
                updateSetting('lowDataMode', !settings.lowDataMode)
              }
            />
            <Toggle
              label="Smart Loading"
              checked={settings.smartLoading}
              onChange={() =>
                updateSetting('smartLoading', !settings.smartLoading)
              }
            />
            <div className="flex items-center justify-between min-h-[48px]">
              <span className="text-white text-sm font-medium">
                Thumbnail Quality
              </span>
              <PillSelector
                options={['Low', 'Medium', 'High']}
                selected={
                  settings.thumbnailQuality.charAt(0).toUpperCase() +
                  settings.thumbnailQuality.slice(1)
                }
                onChange={(val) =>
                  updateSetting(
                    'thumbnailQuality',
                    val.toLowerCase() as 'low' | 'medium' | 'high'
                  )
                }
              />
            </div>
          </div>
        </section>

        {/* Security Section */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-grovix-purple" />
            <h2 className="text-white font-semibold text-base">Security</h2>
          </div>
          <div className="bg-grovix-card border border-grovix-border rounded-2xl p-4 space-y-1">
            <Toggle
              label="Safe Redirect"
              checked={settings.safeRedirect}
              onChange={() =>
                updateSetting('safeRedirect', !settings.safeRedirect)
              }
            />
            <Toggle
              label="External Warning"
              checked={settings.externalWarning}
              onChange={() =>
                updateSetting('externalWarning', !settings.externalWarning)
              }
            />
            <Toggle
              label="Secure Browser Mode"
              checked={settings.secureBrowser}
              onChange={() =>
                updateSetting('secureBrowser', !settings.secureBrowser)
              }
            />
          </div>
        </section>

        {/* Storage Section */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <HardDrive className="w-4 h-4 text-grovix-purple" />
            <h2 className="text-white font-semibold text-base">Storage</h2>
          </div>
          <div className="bg-grovix-card border border-grovix-border rounded-2xl p-4">
            {/* Progress Bar */}
            <div className="mb-3">
              <div className="flex justify-between mb-1">
                <span className="text-white text-sm font-medium">
                  Used: {storageUsed} GB / {storageTotal} GB
                </span>
                <Badge variant="purple">
                  {Math.round(storagePercent)}%
                </Badge>
              </div>
              <div className="w-full h-2 bg-grovix-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-grovix-purple rounded-full transition-all duration-300"
                  style={{ width: `${storagePercent}%` }}
                />
              </div>
            </div>

            {/* Breakdown */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between">
                <span className="text-grovix-muted text-xs">Downloads</span>
                <span className="text-white text-xs">800MB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-grovix-muted text-xs">Cache</span>
                <span className="text-white text-xs">250MB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-grovix-muted text-xs">Other</span>
                <span className="text-white text-xs">150MB</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={() => setClearCacheModal(true)}
                className="w-full h-12 rounded-xl bg-grovix-secondary text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors duration-150 hover:bg-grovix-secondary/80 active:scale-[0.97]"
                type="button"
              >
                🗑️ Clear Cache
              </button>
              <button
                onClick={() => setOptimizeModal(true)}
                className="w-full h-12 rounded-xl bg-grovix-secondary text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors duration-150 hover:bg-grovix-secondary/80 active:scale-[0.97]"
                type="button"
              >
                ⚙️ Optimize Memory
              </button>
              <button
                onClick={() => setResetModal(true)}
                className="w-full h-12 rounded-xl bg-grovix-secondary text-red-500 text-sm font-medium flex items-center justify-center gap-2 transition-colors duration-150 hover:bg-grovix-secondary/80 active:scale-[0.97]"
                type="button"
              >
                🔄 Reset App
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Confirm Modals */}
      <ConfirmModal
        isOpen={clearCacheModal}
        onClose={() => setClearCacheModal(false)}
        onConfirm={handleClearCache}
        title="Clear Cache"
        message="This will clear all cached data. Your downloads and settings will not be affected. Continue?"
      />
      <ConfirmModal
        isOpen={optimizeModal}
        onClose={() => setOptimizeModal(false)}
        onConfirm={handleOptimize}
        title="Optimize Memory"
        message="This will optimize app memory usage by clearing temporary files and reloading resources. Continue?"
      />
      <ConfirmModal
        isOpen={resetModal}
        onClose={() => setResetModal(false)}
        onConfirm={handleReset}
        title="Reset App"
        message="This will reset all app settings to their defaults. Your downloads will not be affected. This action cannot be undone. Continue?"
      />
    </div>
  );
}
