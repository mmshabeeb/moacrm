import sizeMatrixData from '../rules/sizeMatrix.json';
import { MOASizeRecommendation } from '../models/customisation';

export interface CustomerInputMeasurements {
  height_cm?: number;
  height_ft?: number;
  bust_inches?: number;
  fit_preference?: 'fitted' | 'regular' | 'loose' | 'extra_loose';
  desired_length_adjustment_inches?: number;
}

export class MOASizingEngine {
  private matrix = sizeMatrixData;

  /**
   * Convert height in feet/inches to cm (e.g. 5.5 ft or 5'6")
   */
  public convertFeetToCm(feet: number): number {
    return Math.round(feet * 30.48);
  }

  /**
   * Convert inches to cm
   */
  public convertInchesToCm(inches: number): number {
    return Math.round(inches * 2.54 * 10) / 10;
  }

  /**
   * Convert cm to inches
   */
  public convertCmToInches(cm: number): number {
    return Math.round((cm / 2.54) * 10) / 10;
  }

  /**
   * Evaluates standard size recommendation based on customer height and bust
   */
  public recommendSize(input: CustomerInputMeasurements): MOASizeRecommendation {
    let heightCm = input.height_cm;
    if (!heightCm && input.height_ft) {
      heightCm = this.convertFeetToCm(input.height_ft);
    }

    if (!heightCm) {
      return {
        standard_size: 56, // fallback median
        base_length_inches: 56,
        base_bust_flat_inches: 23,
        base_bust_circumference_inches: 46,
        customer_height_cm: 0,
        confidence: 0.3,
        reasoning: "Height not specified; defaulting to median reference size 56 for consultation."
      };
    }

    // Find closest standard size in matrix
    const sizes = this.matrix.standard_sizes;
    let closest = sizes[0];
    let minDiff = Math.abs(heightCm - closest.height_cm);

    for (let i = 1; i < sizes.length; i++) {
      const diff = Math.abs(heightCm - sizes[i].height_cm);
      if (diff < minDiff) {
        minDiff = diff;
        closest = sizes[i];
      }
    }

    let confidence = 0.95;
    let reasoning = `Customer height of ${heightCm}cm maps directly to Size ${closest.size} (standard height ${closest.height_cm}cm / ${closest.height_ft}ft, length ${closest.abaya_length_inches}").`;

    // Cross check with bust if provided
    if (input.bust_inches) {
      const bustAllowance = closest.bust_circumference_inches - input.bust_inches;
      if (bustAllowance < 2) {
        reasoning += ` Note: Customer bust is ${input.bust_inches}", while standard size ${closest.size} has ${closest.bust_circumference_inches}" circumference. Custom ease adjustment or sizing up is advised.`;
      }
    }

    return {
      standard_size: closest.size,
      base_length_inches: closest.abaya_length_inches,
      base_bust_flat_inches: closest.bust_flat_inches,
      base_bust_circumference_inches: closest.bust_circumference_inches,
      customer_height_cm: heightCm,
      customer_height_ft: input.height_ft,
      confidence,
      reasoning
    };
  }

  /**
   * Check whether a requested customisation is within safe bounds
   */
  public validateAlterations(lengthDeltaInches?: number, sleeveDeltaInches?: number): {
    isValid: boolean;
    requiresSeniorReview: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    let requiresSeniorReview = false;

    if (lengthDeltaInches !== undefined) {
      const maxShorten = this.matrix.alteration_rules.length_customisation.max_shorten_inches;
      const maxLengthen = this.matrix.alteration_rules.length_customisation.max_lengthen_inches;
      if (lengthDeltaInches < -maxShorten || lengthDeltaInches > maxLengthen) {
        issues.push(`Requested length adjustment (${lengthDeltaInches > 0 ? '+' : ''}${lengthDeltaInches}") exceeds safe bounds (+/- 6").`);
        requiresSeniorReview = true;
      }
    }

    if (sleeveDeltaInches !== undefined) {
      const maxShorten = this.matrix.alteration_rules.sleeve_customisation.max_shorten_inches;
      const maxLengthen = this.matrix.alteration_rules.sleeve_customisation.max_lengthen_inches;
      if (sleeveDeltaInches < -maxShorten || sleeveDeltaInches > maxLengthen) {
        issues.push(`Requested sleeve adjustment (${sleeveDeltaInches > 0 ? '+' : ''}${sleeveDeltaInches}") exceeds standard allowance (+/- 4").`);
        requiresSeniorReview = true;
      }
    }

    return {
      isValid: issues.length === 0,
      requiresSeniorReview,
      issues
    };
  }
}
