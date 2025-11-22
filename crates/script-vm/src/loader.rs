use crate::vm::ScriptVM;
use crate::node::{LogicNode, NodeType};
use crate::nodes::create_behavior;
use byteorder::{ByteOrder, LittleEndian};
use std::convert::TryFrom;

pub fn load_graph(vm: &mut ScriptVM, data: &[u8]) -> Result<(), String> {
    if data.len() < 8 {
        return Err("Invalid data length".to_string());
    }
    
    // Magic bytes "LGCB"
    if &data[0..4] != b"LGCB" {
        return Err("Invalid magic bytes".to_string());
    }
    
    let version = LittleEndian::read_u32(&data[4..8]);
    if version != 1 {
        return Err(format!("Unsupported version: {}", version));
    }
    
    let mut cursor = 8;
    
    // 1. Nodes Section
    if cursor + 4 > data.len() { return Err("Unexpected EOF at nodes count".to_string()); }
    let node_count = LittleEndian::read_u32(&data[cursor..cursor+4]);
    cursor += 4;
    
    for _ in 0..node_count {
        if cursor + 8 > data.len() { return Err("Unexpected EOF at node definition".to_string()); }
        let id = LittleEndian::read_u32(&data[cursor..cursor+4]);
        let type_id_raw = LittleEndian::read_u16(&data[cursor+4..cursor+6]);
        let config_len = LittleEndian::read_u16(&data[cursor+6..cursor+8]) as usize;
        cursor += 8;
        
        if cursor + config_len > data.len() { return Err("Unexpected EOF at node config".to_string()); }
        let config = &data[cursor..cursor+config_len];
        cursor += config_len;
        
        let type_id = NodeType::from(type_id_raw);
        let behavior = create_behavior(type_id, config);
        
        let node = LogicNode {
            id,
            type_id,
            behavior,
        };
        
        vm.add_node(node);
    }
    
    // 2. Connections Section
    if cursor + 4 > data.len() { return Err("Unexpected EOF at connections count".to_string()); }
    let conn_count = LittleEndian::read_u32(&data[cursor..cursor+4]);
    cursor += 4;
    
    for _ in 0..conn_count {
        if cursor + 10 > data.len() { return Err("Unexpected EOF at connection".to_string()); }
        let src_node = LittleEndian::read_u32(&data[cursor..cursor+4]);
        let src_port = data[cursor+4];
        let target_node = LittleEndian::read_u32(&data[cursor+5..cursor+9]);
        let target_port = data[cursor+9];
        cursor += 10;
        
        vm.add_connection(src_node, src_port, target_node, target_port);
    }
    
    Ok(())
}
