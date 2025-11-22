#[derive(Debug, Clone)]
pub enum SignalData {
    None,
    Number(f64),
    Bool(bool),
    String(String),
    Entity(u32),
}

#[derive(Debug, Clone)]
pub struct Signal {
    pub source_node: u32,
    pub source_port: u8,
    pub data: SignalData,
}

