// Template sentence for the "Insight Engine Analysis" panel when a container
// has no alert explanation to show. Built only from the fitted trend.

import { minutesUntil } from './regression'
import { formatDuration } from './format'

// Below this absolute change per hour, the trend is described as stable.
const STABLE_PER_HOUR = 0.5

export function fitStrength(rSquared) {
  if (rSquared == null) return null
  if (rSquared >= 0.7) return 'strong'
  if (rSquared >= 0.4) return 'moderate'
  return 'weak'
}

export function trendInsight({ metricName, fit, threshold }) {
  if (!fit?.hasEnoughData) {
    return `Not enough readings yet to analyse the ${metricName.toLowerCase()} trend.`
  }

  const perHour = fit.slope * 60
  const current = `${fit.currentValue.toFixed(1)}%`
  let sentence

  if (Math.abs(perHour) < STABLE_PER_HOUR) {
    sentence = `${metricName} is stable at ${current} (${perHour >= 0 ? '+' : ''}${perHour.toFixed(2)}% per hour); no breach of ${threshold}% is projected.`
  } else if (perHour > 0) {
    const minutes = minutesUntil(fit, threshold)
    if (fit.currentValue >= threshold) {
      sentence = `${metricName} is already above the ${threshold}% threshold at ${current} and still rising (+${perHour.toFixed(2)}% per hour).`
    } else if (minutes != null) {
      sentence = `${metricName} is rising at +${perHour.toFixed(2)}% per hour (now ${current}); at this rate it would cross ${threshold}% in about ${formatDuration(minutes)}.`
    } else {
      sentence = `${metricName} is rising at +${perHour.toFixed(2)}% per hour (now ${current}).`
    }
  } else {
    sentence = `${metricName} is falling at ${perHour.toFixed(2)}% per hour (now ${current}); no breach of ${threshold}% is projected.`
  }

  const strength = fitStrength(fit.rSquared)
  if (strength) {
    sentence += ` The straight-line fit explains ${Math.round(fit.rSquared * 100)}% of the variation (R squared), so treat this projection as ${strength}.`
  }
  return sentence
}
