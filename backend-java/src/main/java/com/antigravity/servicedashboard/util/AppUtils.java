package com.antigravity.servicedashboard.util;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class AppUtils {

    /**
     * Applies date shorthand regex replacement (e.g. "> -2d" -> SQL datetime)
     */
    public static String applyDateRegex(String input) {
        if (input == null)
            return null;
        // Regex: (Operator) (Number) (Unit d/m/y)
        Pattern p = Pattern.compile("([><]=?|!=|=)\\s*([+-]?\\d+)([dmy])");
        Matcher m = p.matcher(input);

        StringBuilder sb = new StringBuilder();
        while (m.find()) {
            String op = m.group(1);
            String val = m.group(2);
            String unit = m.group(3);
            String unitStr = "days";
            if ("m".equals(unit))
                unitStr = "months";
            else if ("y".equals(unit))
                unitStr = "years";

            m.appendReplacement(sb, String.format("%s datetime('now', '%s %s', 'start of day')", op, val, unitStr));
        }
        m.appendTail(sb);
        return sb.toString();
    }

    /**
     * Validates that a table name contains only alphanumeric characters and
     * underscores.
     */
    public static boolean isValidTableName(String tableName) {
        return tableName != null && tableName.matches("^[a-zA-Z0-9_]+$");
    }
}
