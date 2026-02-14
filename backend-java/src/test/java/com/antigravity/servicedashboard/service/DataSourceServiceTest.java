package com.antigravity.servicedashboard.service;

import com.antigravity.servicedashboard.entity.DataSource;
import com.antigravity.servicedashboard.entity.SyncDefinition;
import com.antigravity.servicedashboard.repository.DataSourceRepository;
import com.antigravity.servicedashboard.repository.SyncDefinitionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class DataSourceServiceTest {

    @Mock
    private DataSourceRepository repository;

    @Mock
    private SyncDefinitionRepository syncRepo;

    @Mock
    private SyncService syncService;

    @InjectMocks
    private DataSourceService dataSourceService;

    @Test
    public void testGetAll() {
        when(repository.findAll()).thenReturn(Collections.emptyList());
        List<DataSource> result = dataSourceService.getAll();
        assertNotNull(result);
        assertTrue(result.isEmpty());
    }

    @Test
    public void testCreate() {
        DataSource ds = new DataSource();
        ds.setName("Test");
        when(repository.save(ds)).thenReturn(ds);

        DataSource result = dataSourceService.create(ds);
        assertEquals("Test", result.getName());
    }

    @Test
    public void testDelete_WithSyncs() {
        // Setup
        when(repository.existsById(1L)).thenReturn(true);
        SyncDefinition sync = new SyncDefinition();
        sync.setId(10L);
        when(syncRepo.findBySourceId(1L)).thenReturn(List.of(sync));

        // Execute
        boolean deleted = dataSourceService.delete(1L);

        // Verify
        assertTrue(deleted);
        verify(syncService).delete(10L);
        verify(repository).deleteById(1L);
    }

    @Test
    public void testDelete_NotFound() {
        when(repository.existsById(1L)).thenReturn(false);
        boolean deleted = dataSourceService.delete(1L);
        assertFalse(deleted);
        verify(repository, never()).deleteById(any());
    }
}
