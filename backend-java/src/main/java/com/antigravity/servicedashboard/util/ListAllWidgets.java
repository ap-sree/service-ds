package com.antigravity.servicedashboard.util;

import java.sql.*;

public class ListAllWidgets {
    public static void main(String[] args) {
        String h2Url = "jdbc:h2:file:./data/appdb;CIPHER=AES";
        String user = "sa";
        String password = "changeme filepwd changeme";

        try {
            Class.forName("org.h2.Driver");
            Connection conn = DriverManager.getConnection(h2Url, user, password);
            Statement stmt = conn.createStatement();
            ResultSet rs = stmt
                    .executeQuery("SELECT \"id\", \"title\", \"type\" FROM \"widget_definitions\" ORDER BY \"id\"");

            System.out.println("Widgets in H2 database:");
            int count = 0;
            while (rs.next()) {
                System.out.println("ID: " + rs.getLong("id") + ", Title: " + rs.getString("title") + ", Type: "
                        + rs.getString("type"));
                count++;
            }
            System.out.println("Total widgets: " + count);

            rs.close();
            stmt.close();
            conn.close();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
