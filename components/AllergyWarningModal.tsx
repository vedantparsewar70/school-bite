import React, { useState } from 'react';
import { AlertTriangle, X, ShieldAlert, CheckCircle } from 'lucide-react';

interface AllergyWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  childName: string;
  mealName: string;
  matchingAllergens: string[];
  allowOrdering: boolean; // From admin school policy
}

export default function AllergyWarningModal({
  isOpen,
  onClose,
  onConfirm,
  childName,
  mealName,
  matchingAllergens,
  allowOrdering = true,
}: AllergyWarningModalProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border-2 border-rose-300 overflow-hidden space-y-0">
        {/* Urgent Warning Header */}
        <div className="bg-rose-500 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-xl">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-100">
                School Safety Protocol
              </span>
              <h3 className="text-lg font-black tracking-tight leading-tight">⚠ ALLERGY ALERT</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs space-y-2 text-rose-950">
            <p className="font-extrabold text-sm text-rose-900">
              Potential allergen conflict detected!
            </p>
            <p className="text-slate-700 leading-relaxed">
              This meal (<strong className="text-slate-900">{mealName}</strong>) contains ingredients or allergens associated with{' '}
              <strong className="text-slate-900">{childName}</strong>'s registered allergy profile:
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {matchingAllergens.map((alg, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 bg-rose-600 text-white font-black text-xs rounded-lg shadow-2xs"
                >
                  ⚠ Contains {alg}
                </span>
              ))}
            </div>
          </div>

          {!allowOrdering ? (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-amber-800">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                School Policy Restriction
              </p>
              <p className="text-amber-800">
                The school canteen policy currently disallows ordering meals with conflicting allergens for child safety.
              </p>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              <p className="text-xs text-slate-600">
                School policy permits proceeding only with explicit parental acknowledgment:
              </p>
              <label className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/70 transition-colors">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-rose-600 focus:ring-rose-500 accent-rose-600"
                />
                <span className="text-xs font-semibold text-slate-800 leading-tight">
                  I understand this warning regarding {childName}'s allergy profile and want to continue adding this meal.
                </span>
              </label>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            {allowOrdering && (
              <button
                type="button"
                disabled={!acknowledged}
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all ${
                  acknowledged
                    ? 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-rose-500/20'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                Acknowledge & Continue
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
