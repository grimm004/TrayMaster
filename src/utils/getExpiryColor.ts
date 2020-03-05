import dayjs, {Dayjs} from "dayjs";
import {ExpiryRange} from "../core/WarehouseModel";
import {SimpleExpiryRange} from "../pages/ShelfViewPage";
import {MONTHS_TRANSLATOR} from "./monthsTranslator";


/**
 *  interface specifying an ExpiryRange with non-null from and to
 */
interface SafeExpiryRange {
    from: number;
    to: number;
    label: string;
}


/**
 * Period to use for a complete cycle around the hue color wheel
 * Using 8 currently because that's the number on the expiry keyboard (and what common food lasts longer than 8 years??)
 */
const YEAR_PERIOD = 8;

// SOURCE: https://campushippo.com/lessons/how-to-convert-rgb-colors-to-hexadecimal-with-javascript-78219fdb
/**
 * Converts a single member of an rgb(x, x, x) color value into two hex digits
 * @param rgb - one of the three r, g, b, values constituting a color
 */
function rgbToHex(rgb: number): string {
    let hex = Math.round(Number(rgb)).toString(16);
    if (hex.length < 2) {
        hex = `0${hex}`;
    }
    return hex;
}

// SOURCE: https://gist.github.com/mjackson/5311256#gistcomment-2789005
/**
 * Converts an HSL color value to HSL. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 *
 * @param   h       The hue, in [0-360]
 * @param   s       The saturation, in [0-1]
 * @param   l       The lightness, in [0-1]
 * @return  string  The hex code corresponding to the given HSL value
 */
function hslToHex(h: number, s: number, l: number): string {
    const hprime = h / 60;
    const c = l * s;
    const x = c * (1 - Math.abs(hprime % 2 - 1));
    const m = l - c;
    let r, g, b;
    if (!hprime) {
        r = 0;
        g = 0;
        b = 0;
    }
    if (hprime >= 0 && hprime < 1) {
        r = c;
        g = x;
        b = 0;
    }
    if (hprime >= 1 && hprime < 2) {
        r = x;
        g = c;
        b = 0;
    }
    if (hprime >= 2 && hprime < 3) {
        r = 0;
        g = c;
        b = x;
    }
    if (hprime >= 3 && hprime < 4) {
        r = 0;
        g = x;
        b = c;
    }
    if (hprime >= 4 && hprime < 5) {
        r = x;
        g = 0;
        b = c;
    }
    if (hprime >= 5 && hprime < 6) {
        r = c;
        g = 0;
        b = x;
    }

    r = Math.round(((r ? r : 0) + m) * 255);
    g = Math.round(((g ? g : 0) + m) * 255);
    b = Math.round(((b ? b : 0) + m) * 255);

    return `#${[r, g, b].map(rgbToHex).join("")}`;
}

/**
 * Takes in the length of an expiry range in days (1-366 inclusive) and returns a saturation value to use
 * Used inside getExpiryColor
 * @see getExpiryColor
 * @param days - the length of an expiry range in days
 * @return number - the saturation to use for that range
 */
function getSaturation(days: number): number {
    if (days <= 0) { // not a valid range
        return 0;
    } else if (days <= 40) { // month
        return 1;
    } else if (days <= 100) { // quarter
        return 0.6;
    } else if (days <= 366) { // year
        return 0.5;
    } else { // more than a year
        return 0;
    }
}


/**
 * Takes in an ExpiryRange object and returns a hex color to use for that range
 * Hue depends on the start time of the expiry range in an 8 year cycle
 * Saturation depends on the length of the range (more precision = more intense color)
 * @param range {ExpiryRange} - the expiry range to return a color for
 * @return string - the 7-digit hex value to use for that expiry range
 */
function computeColorFromRange(range: SafeExpiryRange): string {
    // get a dayjs date corresponding to the from property of the range, to use later
    const djsDate: Dayjs = dayjs(range.from);

    // Year modulo YEAR_PERIOD
    const modYear: number = djsDate.year() % YEAR_PERIOD;

    // Ratio of the way through the month
    const ratioMonth: number = (djsDate.date()) / djsDate.date(-1).date();

    // Ratio of the way through the year
    const ratioYear: number = ((djsDate.month()) + ratioMonth) / 12;

    // Ratio of the way through the period
    const ratioPeriod = (modYear + ratioYear) / YEAR_PERIOD;

    // get saturation from difference between from and to and return hex value
    const saturation = getSaturation(dayjs(range.to).diff(djsDate, "day"));
    return hslToHex(ratioPeriod * 360, saturation, 1);
}

/**
 * Computes 'hybrid' colour:
 * - hue derived from standard warehouse 5-year colour cycle
 * - saturation derived from expiry range length
 * @param range {ExpiryRange} - the expiry range to return a color for
 * @return string - the 7-digit hex value to use for that expiry range
 */
function computeHybridColorFromRange(range: SafeExpiryRange): string {
    const yearHueCycle = [
        60,
        180,
        320,
        290,
        120
    ];

    const djsDate: Dayjs = dayjs(range.from);

    const saturation = getSaturation(dayjs(range.to).diff(djsDate, "day"));
    return hslToHex(yearHueCycle[djsDate.year() % 5], saturation, 1);
}

/**
 * Computes 'warehouse' colour, derived from standard warehouse 5-year colour cycle
 * @param range {ExpiryRange} - the expiry range to return a color for
 * @return string - the 7-digit hex value to use for that expiry range
 */
function getWarehouseColor(range: SafeExpiryRange): string {
    // todo consider making this a setting
    const yearCycle = [
        "#fff44d",
        "#0ea5ff",
        "#ff97cc",
        "#49ff55"
    ];

    return yearCycle[dayjs(range.from).year() % 4];
}


/**
 * Takes in an ExpiryRange and chooses the colour to use for it, based on current settings
 * @param simple - the expiry range to return a color for
 * @param mode - The mode detailing how colouring should be done, either 'computed', 'hybrid or, 'warehouse'
 * @return string - the 7-digit hex value to use for that expiry range
 */
export function getExpiryColor(
    simple: ExpiryRange | SimpleExpiryRange,
    mode: "computed" | "hybrid" | "warehouse"
): string {

    const range = toExpiryRange(simple);

    if (range.from === null || range.to === null) {
        return "#ffffff00";
    } else if (mode === "computed") {
        return computeColorFromRange(range as SafeExpiryRange);
    } else if (mode === "hybrid") {
        return computeHybridColorFromRange(range as SafeExpiryRange);
    } else {
        return getWarehouseColor(range as SafeExpiryRange);
    }
}

export function toExpiryRange(range: SimpleExpiryRange | ExpiryRange): ExpiryRange {
    // choose range start and end points

    if (range === null || !("year" in range)) {
        return range;
    } else if ("month" in range) {

        const fromDate = new Date(range.year, range.month);
        const toDate = new Date(fromDate);
        toDate.setMonth(fromDate.getMonth() + 1);

        return {
            from: fromDate.getTime(), to: toDate.getTime(),
            label: `${MONTHS_TRANSLATOR[range.month]} ${range.year}`
        };

    } else if ("quarter" in range) {

        // Multiply by 3 to map quarter indices to the first month in that range
        const fromDate = new Date(range.year, range.quarter * 3);
        const toDate = new Date(fromDate);

        toDate.setMonth(fromDate.getMonth() + 3); // increment by 1Q or 3 months

        return {
            from: fromDate.getTime(), to: toDate.getTime(),
            label: `Q${(range.quarter + 1).toString()} ${range.year}`
        };

    } else { // Year

        return {
            from: new Date(range.year, 0).getTime(),
            to: new Date(range.year + 1, 0).getTime(),
            label: `${range.year}`
        };
    }

}


/**
 * Interpolates between the given colour and the given grey colour by the given ratio
 * @param color - the colour to retain the hue of
 * @param grey - the grey to move towards
 * @param ratio - the ratio towards the grey to move
 */
export function interpolateTowardsGrey(color: string, grey: string, ratio: number): string {
    let r: number = parseInt(color.substring(1, 3), 16);
    let g: number = parseInt(color.substring(3, 5), 16);
    let b: number = parseInt(color.substring(5, 7), 16);

    const greyIndex: number = parseInt(grey.substring(1, 3), 16);

    r += (greyIndex - r) * ratio;
    g += (greyIndex - g) * ratio;
    b += (greyIndex - b) * ratio;

    return `#${rgbToHex(r)}${rgbToHex(g)}${rgbToHex(b)}`;
}