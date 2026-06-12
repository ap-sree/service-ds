package com.antigravity.servicedashboard.mapper;

import java.util.List;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import com.antigravity.servicedashboard.dto.WidgetDefinitionDTO;
import com.antigravity.servicedashboard.entity.WidgetDefinition;

@Mapper(componentModel = "spring")
public interface WidgetDefinitionMapper {

    WidgetDefinitionDTO toDTO(WidgetDefinition entity);

    List<WidgetDefinitionDTO> toDTOList(List<WidgetDefinition> entities);

    @Mapping(target = "syncDefinition", ignore = true)
    WidgetDefinition toEntity(WidgetDefinitionDTO dto);
}
