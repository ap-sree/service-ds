package com.antigravity.servicedashboard.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Collections;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.antigravity.servicedashboard.entity.DataSource;
import com.antigravity.servicedashboard.service.DataSourceService;
import com.fasterxml.jackson.databind.ObjectMapper;

@WebMvcTest(DataSourceController.class)
public class DataSourceControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DataSourceService dataSourceService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    public void testGetAll() throws Exception {
        when(dataSourceService.getAll()).thenReturn(Collections.emptyList());

        mockMvc.perform(get("/api/data-sources"))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));
    }

    @Test
    public void testCreate() throws Exception {
        DataSource ds = new DataSource();
        ds.setName("Source1");
        ds.setType("API");
        when(dataSourceService.create(any(DataSource.class))).thenReturn(ds);

        mockMvc.perform(post("/api/data-sources")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(ds)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Source1"));
    }

    @Test
    public void testUpdate_Found() throws Exception {
        DataSource ds = new DataSource();
        ds.setName("Updated");
        when(dataSourceService.update(eq(1L), any(DataSource.class))).thenReturn(Optional.of(ds));

        mockMvc.perform(put("/api/data-sources/1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(ds)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Updated"));
    }

    @Test
    public void testUpdate_NotFound() throws Exception {
        DataSource ds = new DataSource();
        when(dataSourceService.update(eq(1L), any(DataSource.class))).thenReturn(Optional.empty());

        mockMvc.perform(put("/api/data-sources/1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(ds)))
                .andExpect(status().isNotFound());
    }
}
