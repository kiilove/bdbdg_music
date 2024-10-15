import React from "react";
import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom";
import { Layout, Menu } from "antd";
import { ResponsiveProvider } from "./contexts/ResponsiveContext";
import MusicExplorer from "./pages/MusicExplorer";
import AudioEditor from "./pages/AudioEditor";

import SavedMusicList from "./pages/SavedMusicList";


const { Header, Content, Footer } = Layout;

const App = () => {
  return (
    <Router>
      <ResponsiveProvider>
 
          <Layout className="min-h-screen">
            <Header className="bg-blue-500">
              <Menu theme="dark" mode="horizontal" defaultSelectedKeys={["1"]}>
                <Menu.Item key="1">
                  <Link to="/explorer">Explorer</Link>
                </Menu.Item>
                <Menu.Item key="2">
                  <Link to="/saved-music">저장된 음악 목록</Link>
                </Menu.Item>
                <Menu.Item key="3">
                  <Link to="/playlist-manager">플레이리스트 관리</Link>
                </Menu.Item>
                <Menu.Item key="4">
                  <Link to="/weight-classes">체급 관리</Link>
                </Menu.Item>
                {/* 추가 메뉴 항목 */}
              </Menu>
            </Header>
            <Content className="p-4 bg-gray-100">
              <Routes>
                <Route path="/explorer" element={<MusicExplorer />} />
                <Route path="/saved-music" element={<SavedMusicList />} />
               
                <Route path="/editor" element={<AudioEditor />} />
               
                {/* 추가 라우트 */}
              </Routes>
            </Content>
            <Footer style={{ textAlign: "center" }}>
              
              Music App ©2024 Created by You
            </Footer>
          </Layout>
  
      </ResponsiveProvider>
    </Router>
  );
};

export default App;
