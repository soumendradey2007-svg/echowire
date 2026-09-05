import React, { useState } from 'react';
import { IconX, IconShield, IconCheck } from './Icons';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'privacy' | 'terms';
  onAccept?: () => void;
}

export default function LegalModal({ isOpen, onClose, defaultTab = 'privacy', onAccept }: Props) {
  const [tab, setTab] = useState<'privacy' | 'terms'>(defaultTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/20 text-accent flex items-center justify-center">
              <IconShield size={16} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">EchoWire Legal & Compliance</h2>
              <p className="text-[11px] text-zinc-400">Digital Personal Data Protection Act (DPDPA 2023) Compliant</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Close"
          >
            <IconX size={16} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-zinc-800 px-6 bg-zinc-900/80">
          <button
            onClick={() => setTab('privacy')}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              tab === 'privacy'
                ? 'border-accent text-accent'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Privacy Policy (DPDP Act 2023)
          </button>
          <button
            onClick={() => setTab('terms')}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              tab === 'terms'
                ? 'border-accent text-accent'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Terms of Service
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 text-zinc-300 text-xs leading-relaxed space-y-5">
          {tab === 'privacy' ? (
            <div className="space-y-4">
              <div>
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2">
                  DPDP ACT, 2023 NOTICE & POLICY
                </span>
                <h3 className="text-sm font-bold text-zinc-100">1. Notice Under Section 5 of DPDP Act 2023</h3>
                <p className="mt-1 text-zinc-400">
                  This Notice and Privacy Policy explains how EchoWire (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) processes personal data in accordance with the <strong>Digital Personal Data Protection Act, 2023 (DPDP Act 2023)</strong> and applicable global data privacy standards. By creating an account or using our platform, you give free, specific, informed, unconditional, and unambiguous consent as required under Section 6 of the Act.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-zinc-100">2. Personal Data We Collect</h3>
                <p className="mt-1 text-zinc-400">We adhere to strict data minimization principles (Section 8) and only collect data necessary to provide communication services:</p>
                <ul className="list-disc pl-5 mt-1.5 space-y-1 text-zinc-400">
                  <li><strong>Account Data:</strong> Username, email address, optional profile bio, and display tag.</li>
                  <li><strong>Authentication Data:</strong> Cryptographically hashed passwords (using Argon2id). We never store raw passwords.</li>
                  <li><strong>Session & Security Telemetry:</strong> IP address (used solely for rate-limiting, DDoS prevention, and anti-abuse defense), browser User-Agent, and token hashes.</li>
                </ul>
              </div>

              <div className="p-3 bg-accent/10 border border-accent/20 rounded-xl">
                <h3 className="text-xs font-bold text-accent">3. Voice & Audio Streams (Zero Recording Guarantee)</h3>
                <p className="mt-1 text-zinc-300 text-[11px] leading-relaxed">
                  Voice communication in EchoWire uses decentralized <strong>WebRTC peer-to-peer streaming</strong>. Your voice audio is encrypted in transit and transmitted directly between room participants. <strong>We do not record, listen to, store, analyze, or transcribe any voice or microphone audio.</strong> Audio frames exist transiently in memory only for immediate live playback.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-zinc-100">4. Specific Purpose of Data Processing (Section 5(1))</h3>
                <p className="mt-1 text-zinc-400">Your personal data is processed solely for:</p>
                <ul className="list-disc pl-5 mt-1.5 space-y-1 text-zinc-400">
                  <li>Authenticating your user identity and maintaining secure sessions.</li>
                  <li>Enabling voice rooms, text messaging, and friends list synchronization.</li>
                  <li>Protecting the platform against automated spam bots, credential stuffing, and abusive behavior.</li>
                  <li>We do <strong>NOT</strong> sell, rent, or monetize your personal data with third-party advertisers.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-bold text-zinc-100">5. Children&apos;s Personal Data (Section 9 DPDP Act)</h3>
                <p className="mt-1 text-zinc-400">
                  In compliance with Section 9 of the DPDP Act 2023, EchoWire does not process the personal data of individuals under 18 years of age without verifiable parental consent, nor do we engage in tracking, behavioral monitoring, or targeted advertising directed at children. Users must be at least 13 years old to use the service, with parental/guardian approval if below the age of majority.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-zinc-100">6. Rights of the Data Principal (Sections 11–14)</h3>
                <p className="mt-1 text-zinc-400">As a Data Principal under the DPDP Act 2023, you enjoy the following rights:</p>
                <ul className="list-disc pl-5 mt-1.5 space-y-1 text-zinc-400">
                  <li><strong>Right to Access:</strong> You can view all personal details stored about you in your Profile settings.</li>
                  <li><strong>Right to Correction & Updating:</strong> You can update your username, bio, and status at any time.</li>
                  <li><strong>Right to Erasure (Deletion):</strong> You have the right to request full erasure of your account and associated personal data.</li>
                  <li><strong>Right to Withdraw Consent:</strong> You may withdraw your consent at any time by closing your account or contacting our Grievance Officer.</li>
                  <li><strong>Right of Grievance Redressal:</strong> You have a right to readily available grievance redressal.</li>
                  <li><strong>Right to Nominate:</strong> You have the right to nominate an individual to exercise your rights in event of death or incapacity.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-bold text-zinc-100">7. Data Protection & Grievance Redressal Mechanism</h3>
                <p className="mt-1 text-zinc-400">
                  For inquiries, data access/deletion requests, or privacy concerns, you may contact our designated Grievance Officer:
                </p>
                <div className="mt-2 p-2.5 bg-zinc-950 rounded-lg border border-zinc-800 text-[11px] text-zinc-400 font-mono">
                  Grievance Officer: EchoWire Data Privacy Cell<br />
                  Email: privacy@echowire.app<br />
                  Response Window: Within 30 days as mandated by DPDP Rules
                </div>
                <p className="mt-2 text-[11px] text-zinc-500">
                  If unsatisfied with our grievance resolution, you have the right under Section 13(3) of the Act to submit a complaint directly to the <strong>Data Protection Board of India</strong>.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-100">1. Acceptance of Terms</h3>
                <p className="mt-1 text-zinc-400">
                  By accessing or registering on EchoWire (&ldquo;the Service&rdquo;), you agree to be bound by these Terms of Service. If you do not agree to all terms, you are prohibited from using the platform.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-zinc-100">2. Acceptable Use & Conduct</h3>
                <p className="mt-1 text-zinc-400">You agree not to use EchoWire to:</p>
                <ul className="list-disc pl-5 mt-1.5 space-y-1 text-zinc-400">
                  <li>Transmit hate speech, harassment, threats, defamatory, obscene, or unlawful content.</li>
                  <li>Broadcast copyrighted audio or music without appropriate licenses or authorization.</li>
                  <li>Disrupt voice channels through acoustic sabotage, spam audio bots, or microphone flooding.</li>
                  <li>Attempt to bypass rate limits, probe system vulnerabilities, or tamper with WebSocket/API protocols.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-bold text-zinc-100">3. Room Ownership & Moderation</h3>
                <p className="mt-1 text-zinc-400">
                  Users who create voice rooms are designated as Room Owners. Room Owners have administrative authority to moderate participant access, configure privacy settings, and remove or kick disruptive members. EchoWire reserves the right to suspend or terminate any room or account that violates safety policies.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-zinc-100">4. Account Responsibility & Security</h3>
                <p className="mt-1 text-zinc-400">
                  You are responsible for safeguarding your credentials. You agree to notify us immediately of any unauthorized use of your account. EchoWire will not be liable for any losses caused by unauthorized account access.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-zinc-100">5. Limitation of Liability & Disclaimers</h3>
                <p className="mt-1 text-zinc-400">
                  EchoWire is provided &ldquo;as-is&rdquo; and &ldquo;as-available&rdquo; without warranties of any kind. We do not guarantee uninterrupted, latency-free voice streaming or 100% uptime. Under no circumstances will EchoWire be liable for indirect, incidental, or consequential damages resulting from your use of the platform.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-zinc-100">6. Modifications to Service and Terms</h3>
                <p className="mt-1 text-zinc-400">
                  We reserve the right to modify these Terms or update service capabilities at any time. Continued use of the platform following updates represents your binding acceptance of modified terms.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-950/60">
          <p className="text-[11px] text-zinc-500 hidden sm:block">
            Last updated: September 2026
          </p>
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>
            {onAccept && (
              <button
                onClick={() => {
                  onAccept();
                  onClose();
                }}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-accent hover:bg-accent/90 rounded-lg transition-colors cursor-pointer shadow-sm"
              >
                <IconCheck size={14} />
                <span>I Understand & Accept</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
